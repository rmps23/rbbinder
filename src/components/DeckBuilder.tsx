"use client";

import { SlideGroup } from "@/components/SlideGroup";
import { ListSkeleton } from "@/components/Skeletons";
import { Select } from "@/components/Select";
import { MultiSelect } from "@/components/MultiSelect";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { DeckTextModal } from "./DeckTextModal";
import { WantsModal } from "./WantsModal";
import { useCollection } from "@/lib/useCollection";
import { cardmarketWants } from "@/lib/wants";
import { PRINTING_LABEL, printingKind } from "@/lib/setCollection";
import { CardDetailModal } from "./CardDetailModal";
import { DeckStats } from "./DeckStats";
import { ArtView, BulkView, CardArt, EyeButton, ListView, OwnedBadge, RulesPanel, useCardPreview, type CompareData, type Row } from "./DeckViews";
import { DOMAIN_OPTIONS } from "@/lib/constants";
import { availableFinishes } from "@/lib/cardFinish";
import { isBanned } from "@/lib/banlist";
import { buildDeckIndex, cardKey, displayName, exportDeck, neededByKey, parseDeck, ZONES } from "@/lib/deck";
import { belongsInPool, checkDeck, hasRuleData, LIMITS, whyNot } from "@/lib/deckRules";
import { domainColor } from "@/lib/style";
import { matchesSearch, searchInfo } from "@/lib/cardSearch";
import { sortCards, type SortDir, type SortKey } from "@/lib/cardSort";
import SortMenu from "./SortMenu";
import type { Deck, DeckEntry, DeckZone, RiftCard } from "@/lib/types";

const STEP = 48;
type Mobile = "pool" | "deck";
type View = "list" | "art" | "stats" | "bulk";
type SaveState = "saved" | "saving" | "error";

const POOL_ORDER: DeckZone[] = ["legend", "champion", "main", "battlefield", "rune", "sideboard"];
const VIEWS: { id: View; label: string }[] = [
  { id: "list", label: "List" },
  { id: "art", label: "Full art" },
  { id: "stats", label: "Stats" },
  { id: "bulk", label: "Owned" },
];

const chipSlide = (on: boolean) =>
  `rounded-md px-3 text-sm font-semibold transition ${on ? "text-on-accent" : "text-t2 hover:text-t1"}`;

function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 -rotate-90 shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" className="stroke-cavity" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        className={pct >= 100 ? "stroke-ok" : "stroke-brand-gold"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, pct / 100))}
        style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

export function DeckBuilder({ id }: { id: string }) {
  const { cards, sets, bulk, loading, priceOf } = useAppData();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [save, setSave] = useState<SaveState>("saved");
  const [mobile, setMobile] = useState<Mobile>("pool");
  const [view, setView] = useState<View>("list");
  const [modal, setModal] = useState<null | "import" | "export">(null);
  const [includeRunes, setIncludeRunes] = useState(false);
  const [includeSideboard, setIncludeSideboard] = useState(false);
  const [wantsOpen, setWantsOpen] = useState(false);
  const [printingRow, setPrintingRow] = useState<Row | null>(null);

  const [poolZone, setPoolZone] = useState<DeckZone>("legend");
  const [search, setSearch] = useState("");
  const [domainIds, setDomainIds] = useState<string[]>([]);
  const [setId, setSetId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyBulk, setOnlyBulk] = useState(true);
  const [visible, setVisible] = useState(STEP);
  const { bind: preview, node: previewNode } = useCardPreview();
  const [sortBy, setSortBy] = useState<SortKey>("energy");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [hideBanned, setHideBanned] = useState(true);
  const [inspectCard, setInspectCard] = useState<RiftCard | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) return setLoadError(data?.error ?? "Couldn't load the deck.");
        setDeck(data);
        setName(data.name);
        setEntries(data.entries);
        // Start where the deck needs work.
        const has = (z: DeckZone) => data.entries.some((e: DeckEntry) => e.zone === z);
        setPoolZone(!has("legend") ? "legend" : !has("champion") ? "champion" : "main");
      })
      .catch(() => !cancelled && setLoadError("Couldn't load the deck."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Autosave shortly after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    setSave("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/decks/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, entries }),
        });
        setSave(res.ok ? "saved" : "error");
      } catch {
        setSave("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [id, name, entries]);

  const change = useCallback((fn: (prev: DeckEntry[]) => DeckEntry[]) => {
    dirty.current = true;
    setEntries(fn);
  }, []);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const index = useMemo(() => buildDeckIndex(cards), [cards]);

  // ---------- editing ----------

  // +1 / -1 of a card in a zone (any printing of the same card counts as one).
  const adjust = useCallback(
    (card: RiftCard, zone: DeckZone, delta: number) =>
      change((prev) => {
        const key = cardKey(card);
        const existing = prev.find((e) => e.zone === zone && cardKey(cardById.get(e.cardId) ?? card) === key);
        if (zone === "legend" || zone === "champion") {
          if (delta < 0) return prev.filter((e) => e.zone !== zone);
          return [...prev.filter((e) => e.zone !== zone), { zone, cardId: card.id, qty: 1 }];
        }
        if (!existing) return delta > 0 ? [...prev, { zone, cardId: card.id, qty: delta }] : prev;
        const qty = existing.qty + delta;
        return qty > 0 ? prev.map((e) => (e === existing ? { ...e, qty } : e)) : prev.filter((e) => e !== existing);
      }),
    [change, cardById]
  );

  const say = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3200);
  }, []);

  // Every addition goes through the deck rules; removals are always fine.
  const tryAdjust = useCallback(
    (card: RiftCard, zone: DeckZone, delta: number) => {
      if (delta > 0) {
        const reason = whyNot(card, zone, { entries, cardById });
        if (reason) {
          say(reason);
          return false;
        }
      }
      adjust(card, zone, delta);
      return true;
    },
    [adjust, entries, cardById, say]
  );

  const addFromPool = useCallback(
    (card: RiftCard) => {
      if (isBanned(card)) return;
      if (!tryAdjust(card, poolZone, 1)) return;
      setFlash(card.id);
      setTimeout(() => setFlash((f) => (f === card.id ? null : f)), 300);
      // Walk the user through legend -> champion -> main deck.
      if (poolZone === "legend") setPoolZone("champion");
      else if (poolZone === "champion") setPoolZone("main");
    },
    [tryAdjust, poolZone]
  );

  const moveOne = useCallback(
    (row: Row, to: DeckZone) => {
      const legendCard = entries.find((e) => e.zone === "legend");
      if (to === "champion" && !belongsInPool(row.card, "champion", legendCard && cardById.get(legendCard.cardId))) {
        say(`${displayName(row.card)} can't be your champion for this legend.`);
        return;
      }
      if (to === "sideboard" && entries.filter((e) => e.zone === "sideboard").reduce((n, e) => n + e.qty, 0) >= LIMITS.sideboard) {
        say("The sideboard is full (10).");
        return;
      }
      change((prev) => {
        const { entry } = row;
        let next = prev.map((e) => (e === entry ? { ...e, qty: e.qty - 1 } : e)).filter((e) => e.qty > 0);
        if (to === "champion") next = next.filter((e) => e.zone !== "champion");
        const same = next.find((e) => e.zone === to && e.cardId === entry.cardId);
        return same ? next.map((e) => (e === same ? { ...e, qty: e.qty + 1 } : e)) : [...next, { zone: to, cardId: entry.cardId, qty: 1 }];
      });
    },
    [change, entries, cardById, say]
  );

  // Swap a deck entry to another printing of the same card (regular, alt art, …).
  const setPrinting = useCallback(
    (row: Row, cardId: string) =>
      change((prev) => {
        const { entry } = row;
        const rest = prev.filter((e) => e !== entry);
        const same = rest.find((e) => e.zone === entry.zone && e.cardId === cardId);
        return same
          ? rest.map((e) => (e === same ? { ...e, qty: e.qty + entry.qty } : e))
          : [...rest, { ...entry, cardId }];
      }),
    [change]
  );

  // ---------- derived ----------

  const rowsByZone = useMemo(() => {
    const out = new Map<DeckZone, Row[]>();
    for (const e of entries) {
      const card = cardById.get(e.cardId);
      if (!card) continue;
      const list = out.get(e.zone) ?? [];
      list.push({ entry: e, card });
      out.set(e.zone, list);
    }
    for (const list of out.values()) list.sort((a, b) => (a.card.energy ?? 0) - (b.card.energy ?? 0) || a.card.name.localeCompare(b.card.name));
    return out;
  }, [entries, cardById]);
  const allRows = useMemo(() => [...rowsByZone.values()].flat(), [rowsByZone]);

  const countOf = useCallback((z: DeckZone) => (rowsByZone.get(z) ?? []).reduce((n, r) => n + r.entry.qty, 0), [rowsByZone]);

  const legend = rowsByZone.get("legend")?.[0]?.card;

  const mainTotal = countOf("main") + countOf("champion");
  const progress = Math.round(
    ((Math.min(1, countOf("legend")) + Math.min(40, mainTotal) + Math.min(3, countOf("battlefield")) + Math.min(12, countOf("rune"))) / 56) * 100
  );

  const rules = useMemo(() => checkDeck({ entries, cardById }), [entries, cardById]);
  const ruleData = useMemo(() => hasRuleData(cards), [cards]);

  // Copies you own: bulk + binders, regular printings only.
  const { ownedByKey } = useCollection();
  const ownedOf = useCallback((card: RiftCard) => ownedByKey.get(cardKey(card)) ?? 0, [ownedByKey]);
  // Copies of each card the whole deck uses (all zones), to colour the badges.
  const deckNeeds = useMemo(() => neededByKey(entries, cardById), [entries, cardById]);
  const neededOf = useCallback((card: RiftCard) => deckNeeds.get(cardKey(card))?.needed ?? 0, [deckNeeds]);

  const cheapest = useCallback(
    (key: string): number | null => {
      let best: number | null = null;
      for (const c of index.byKey.get(key) ?? []) {
        const f = availableFinishes(c);
        for (const finish of ["normal", "foil"] as const) {
          if (!f[finish]) continue;
          const p = priceOf(c, finish);
          if (p !== null && (best === null || p < best)) best = p;
        }
      }
      return best;
    },
    [index, priceOf]
  );

  const compare = useMemo<CompareData>(() => {
    const needed = neededByKey(
      entries.filter((e) => (includeRunes || e.zone !== "rune") && (includeSideboard || e.zone !== "sideboard")),
      cardById
    );
    const have: CompareData["have"] = [];
    const missing: CompareData["missing"] = [];
    let missingCost = 0;
    let missingUnpriced = 0;
    let totalNeeded = 0;
    let totalHave = 0;
    for (const [key, { card, needed: n }] of needed) {
      const owned = ownedByKey.get(key) ?? 0;
      const h = Math.min(owned, n);
      const m = n - h;
      totalNeeded += n;
      totalHave += h;
      if (h > 0) have.push({ key, card, qty: h, needed: n });
      if (m > 0) {
        const price = cheapest(key);
        if (price === null) missingUnpriced += m;
        else missingCost += price * m;
        missing.push({ key, card, qty: m, price });
      }
    }
    const byName = (a: { card: RiftCard }, b: { card: RiftCard }) => a.card.name.localeCompare(b.card.name);
    return { have: have.sort(byName), missing: missing.sort(byName), missingCost, missingUnpriced, totalNeeded, totalHave };
  }, [entries, includeRunes, includeSideboard, cardById, ownedByKey, cheapest]);

  // ---------- the card pool ----------

  // Searchable text + keywords of every card name, built once per catalog.
  const searchIndex = useMemo(() => {
    const m = new Map<string, ReturnType<typeof searchInfo>>();
    for (const [key, list] of index.byKey) m.set(key, searchInfo(list));
    return m;
  }, [index]);

  // Cards that can go in this zone at all, before search and filters.
  const zoneCards = useMemo(() => {
    const out: RiftCard[] = [];
    for (const list of index.byKey.values()) if (belongsInPool(list[0], poolZone, legend)) out.push(list[0]);
    return out;
  }, [index, poolZone, legend]);

  // Keyword chips: the keywords that exist on this zone's cards, in alphabetical order.
  const keywordOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of zoneCards) for (const k of searchIndex.get(cardKey(c))?.keywords ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  }, [zoneCards, searchIndex]);

  // Once a legend is chosen the pool is already limited to its domains, so the domain filter is only
  // needed while picking the legend itself (or before one exists).
  const showDomainFilter = !legend || poolZone === "legend";

  const pool = useMemo(() => {
    const q = search.trim();
    const out: RiftCard[] = [];
    for (const rep of zoneCards) {
      const key = cardKey(rep);
      const info = searchIndex.get(key);
      if (q && info && !matchesSearch(info, q)) continue;
      if (keywords.length && !keywords.every((k) => info?.keywords.has(k))) continue;
      // every ticked domain must be on the card (with two ticked, only cards that have both)
      if (showDomainFilter && domainIds.length && !domainIds.every((id) => rep.domains.some((d) => d.id === id))) continue;
      if (setId && !(index.byKey.get(key) ?? []).some((c) => c.set.id === setId)) continue;
      if (onlyBulk && !ownedByKey.has(key)) continue;
      if (hideBanned && isBanned(rep)) continue;
      out.push(rep);
    }
    return sortCards(out, sortBy, sortDir, {
      owned: (c) => ownedByKey.get(cardKey(c)) ?? 0,
      setOrder: (c) => sets.findIndex((s) => s.id === c.set.id),
    }, ownedFirst);
  }, [index, zoneCards, searchIndex, search, keywords, domainIds, showDomainFilter, setId, onlyBulk, hideBanned, ownedByKey, sortBy, sortDir, ownedFirst, sets]);

  useEffect(() => setVisible(STEP), [poolZone, search, domainIds, setId, onlyBulk, hideBanned, keywords, sortBy, sortDir, ownedFirst]);

  const inZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsByZone.get(poolZone) ?? []) m.set(cardKey(r.card), (m.get(cardKey(r.card)) ?? 0) + r.entry.qty);
    return m;
  }, [rowsByZone, poolZone]);

  if (loadError) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-bad">{loadError}</p>
        <Link href="/decks" className="text-brand-gold underline">
          Back to decks
        </Link>
      </div>
    );
  }
  if (loading || !deck) return <ListSkeleton label="Loading deck" />;

  const tgt = (z: DeckZone) => ZONES.find((x) => x.id === z)!;
  
  return (
    <div className="lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col">
      {/* header */}
      <header className="mb-3 rounded-xl border border-line bg-panel px-3 py-2 lg:shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/decks" aria-label="Back to decks" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          </Link>
          <div className="relative shrink-0" role="img" aria-label={`${progress} percent complete`}>
            <Ring pct={progress} />
            <span className="num absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none tracking-tight text-t1">{progress}%</span>
          </div>
          <div className="min-w-0 flex-1 basis-56">
            <input
              value={name}
              onChange={(e) => {
                dirty.current = true;
                setName(e.target.value);
              }}
              aria-label="Deck name"
              className="h-8 w-full rounded-lg border border-transparent bg-transparent px-2 font-display text-xl font-semibold uppercase leading-none tracking-wide text-t1 hover:border-line"
            />
            <p className="num flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 text-xs text-t3">
              {legend ? <span className="font-semibold text-t2">{displayName(legend)}</span> : <span>Pick a legend to start</span>}
              <span><b className="text-t1">{mainTotal}</b>/40 main</span>
              <span><b className="text-t1">{countOf("battlefield")}</b>/3 battlefields</span>
              <span><b className="text-t1">{countOf("rune")}</b>/12 runes</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold ${rules.legal ? "bg-ok/15 text-ok" : "bg-cavity text-t2"}`}>
              {rules.legal ? "✓ Legal deck" : "Not legal yet"}
            </span>
            <span className={`text-xs ${save === "error" ? "text-bad" : "text-t3"}`} aria-live="polite">
              {save === "saving" ? "Saving…" : save === "error" ? "✕ Couldn't save" : "✓ Saved"}
            </span>
            <button type="button" onClick={() => setModal("import")} className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1">
              Import
            </button>
            <button type="button" onClick={() => setModal("export")} className="btn-3d h-9 rounded-lg px-5 font-display text-xs font-semibold uppercase tracking-wide">
              Export
            </button>
          </div>
        </div>
      </header>

      {/* mobile switch */}
      <SlideGroup className="sticky top-2 z-10 mb-3 flex gap-1 rounded-lg border border-line bg-ink p-1 lg:hidden">
        {(["pool", "deck"] as Mobile[]).map((m) => (
          <button key={m} type="button" data-active={mobile === m} onClick={() => setMobile(m)} className={`h-11 flex-1 ${chipSlide(mobile === m)}`}>
            {m === "pool" ? "Cards" : `Deck · ${mainTotal}/40`}
          </button>
        ))}
      </SlideGroup>

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)]">
        {/* ---- pool ---- */}
        <section className={`${mobile === "pool" ? "" : "hidden"} lg:block lg:h-full lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-scroll lg:pr-3`}>
          {/* tabs + filters stay put while the card grid scrolls under them */}
          <div className="mb-4 lg:sticky lg:top-0 lg:z-20 lg:mb-0 lg:bg-ink lg:pb-3">
          <div className="rounded-xl border border-line bg-panel">
          <SlideGroup className="no-scrollbar flex gap-0.5 overflow-x-auto p-1">
            {POOL_ORDER.map((z) => {
              const z0 = tgt(z);
              const on = poolZone === z;
              return (
                <button key={z} type="button" data-active={on} onClick={() => setPoolZone(z)} className={`flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-xs font-semibold transition ${on ? "text-on-accent" : "text-t2 hover:text-t1"}`}>
                  {z0.label}
                  <span className={`num text-[11px] font-medium ${on ? "text-on-accent/75" : "text-t3"}`}>
                    {z === "main" ? mainTotal : countOf(z)}
                    {z0.target ? `/${z0.target}` : z0.max ? `/${z0.max}` : ""}
                  </span>
                </button>
              );
            })}
          </SlideGroup>

          <div className="flex flex-col gap-2 border-t border-line p-2">
            <div className="flex flex-wrap gap-1.5">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tgt(poolZone).label.toLowerCase()} cards: name, text, tag, type…`}
                className="h-9 min-w-[160px] flex-1 rounded-lg border border-line bg-ink px-3 text-sm text-t1 placeholder:text-t3"
              />
              <div className="w-40 shrink-0">
                <Select
                  value={setId}
                  onChange={setSetId}
                  ariaLabel="Filter by set"
                  searchPlaceholder="Search sets…"
                  className="h-9 text-sm"
                  menuMinWidth={220}
                  options={[{ value: "", label: "All sets" }, ...sets.map((s) => ({ value: s.id, label: s.name }))]}
                />
              </div>
              {keywordOptions.length > 0 && (
                <div className="w-44 shrink-0">
                  <MultiSelect
                    values={keywords}
                    onChange={setKeywords}
                    ariaLabel="Keywords"
                    placeholder="Keywords"
                    searchPlaceholder="Search keywords…"
                    className="h-9 text-sm"
                    menuMinWidth={260}
                    options={keywordOptions.map(([k, n]) => ({ value: k, label: k, count: n }))}
                  />
                </div>
              )}
              <SortMenu
                sortBy={sortBy}
                dir={sortDir}
                onChange={(by, dir) => {
                  setSortBy(by);
                  setSortDir(dir);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
            {showDomainFilter && (
            <div className="contents" role="group" aria-label="Domain">
              {DOMAIN_OPTIONS.map((d) => {
                const on = domainIds.includes(d.id);
                // at most two domains at once: once two are picked, the others are greyed out
                const locked = !on && domainIds.length >= 2;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    disabled={locked}
                    title={locked ? "Two domains at most - untick one first" : undefined}
                    onClick={() => setDomainIds((cur) => (on ? cur.filter((x) => x !== d.id) : cur.length >= 2 ? cur : [...cur, d.id]))}
                    className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      on
                        ? "border-line2 bg-cavity text-t1"
                        : locked
                          ? "cursor-not-allowed border-line text-t3 opacity-40"
                          : "border-line text-t2 hover:border-line2 hover:text-t1"
                    }`}
                    style={on ? { boxShadow: `inset 0 -2px 0 ${domainColor(d.id)}` } : undefined}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${locked ? "grayscale" : ""}`} style={{ background: domainColor(d.id) }} aria-hidden="true" />
                    {d.label}
                  </button>
                );
              })}
            </div>
            )}
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
              <button
                type="button"
                role="switch"
                aria-checked={onlyBulk}
                onClick={() => setOnlyBulk((v) => !v)}
                className="flex h-8 items-center gap-2 rounded-lg border border-line bg-ink px-2.5 text-xs font-semibold text-t2 transition hover:border-line2"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${onlyBulk ? "bg-brand-gold" : "bg-cavity"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${onlyBulk ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Only cards I own
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={ownedFirst}
                onClick={() => setOwnedFirst((v) => !v)}
                title="Show the cards you own the most copies of first, then apply the sort above within each group"
                className="flex h-8 items-center gap-2 rounded-lg border border-line bg-ink px-2.5 text-xs font-semibold text-t2 transition hover:border-line2"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${ownedFirst ? "bg-brand-gold" : "bg-cavity"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${ownedFirst ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Most owned first
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={hideBanned}
                onClick={() => setHideBanned((v) => !v)}
                title="Hide the cards that are banned in Constructed"
                className="flex h-8 items-center gap-2 rounded-lg border border-line bg-ink px-2.5 text-xs font-semibold text-t2 transition hover:border-line2"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${hideBanned ? "bg-brand-gold" : "bg-cavity"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hideBanned ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Hide banned
              </button>
              <span className="num ml-auto text-xs text-t3">{pool.length} cards</span>
            </div>
          </div>
          </div>
          </div>

          <div className={poolZone === "battlefield" ? "grid grid-cols-2 gap-3" : "grid grid-cols-3 gap-3 sm:grid-cols-4"}>
            {pool.slice(0, visible).map((card) => {
              const qty = inZone.get(cardKey(card)) ?? 0;
              const owned = ownedByKey.get(cardKey(card)) ?? 0;
              const banned = isBanned(card);
              return (
                <div key={card.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => addFromPool(card)}
                    disabled={banned}
                    aria-label={banned ? `${displayName(card)} is banned` : `Add ${displayName(card)}`}
                    title={banned ? "Banned - can't be added to a deck" : undefined}
                    className={`relative block w-full rounded-xl text-left transition duration-150 ${
                      banned
                        ? "cursor-not-allowed opacity-40 ring-2 ring-transparent"
                        : `active:scale-[0.97] ${flash === card.id ? "shadow-[0_0_0_2px_rgb(var(--accent-soft)),0_0_14px_2px_rgb(var(--accent-soft)/0.55)]" : qty > 0 ? "shadow-[0_0_0_1.5px_rgb(var(--accent)),0_0_9px_1px_rgb(var(--accent)/0.4)]" : "ring-2 ring-transparent hover:ring-line2"}`
                    }`}
                  >
                    <CardArt card={card} sizes="(max-width: 640px) 32vw, 340px" quality={92} className={`rounded-xl ${banned ? "grayscale" : ""}`} />
                    <OwnedBadge owned={owned} large className="absolute bottom-2 left-2" />
                  </button>
                  {qty > 0 && (
                    <span
                      key={qty}
                      title={`${qty} in the deck`}
                      aria-label={`${qty} in the deck`}
                      className="num pointer-events-none absolute -right-2.5 -top-2.5 z-10 flex h-8 min-w-8 animate-pop items-center justify-center rounded-lg bg-brand-gold px-2 text-base font-bold text-on-accent shadow-[0_0_8px_1px_rgb(var(--accent)/0.5)]"
                    >
                      ×{qty}
                    </span>
                  )}
                  <EyeButton card={card} preview={preview} onInspect={setInspectCard} className="absolute left-1.5 top-1.5 bg-ink/95 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100" />
                  {qty > 0 && (
                    <button
                      type="button"
                      aria-label={`Remove one ${displayName(card)}`}
                      title="Remove one"
                      onClick={() => adjust(card, poolZone, -1)}
                      className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-lg border border-line2 bg-ink/95 text-t1 transition hover:border-bad hover:text-bad"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {pool.length === 0 && (
            <p className="py-12 text-center text-sm text-t3">
              {legend || poolZone === "legend" ? "No cards match." : "Pick a legend first - the other cards depend on its domains."}
            </p>
          )}
          {pool.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + STEP)}
              className="mt-4 h-11 w-full rounded-xl border border-line bg-panel text-sm font-semibold text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1"
            >
              Show more ({pool.length - visible} left)
            </button>
          )}
        </section>

        {/* ---- workspace ---- */}
        <section
          className={`${mobile === "deck" ? "" : "hidden"} rounded-xl border border-line bg-panel p-3 sm:p-4 lg:block lg:h-full lg:min-h-0 lg:overflow-y-scroll`}
        >
          <SlideGroup className="mb-4 flex gap-1 rounded-lg border border-line bg-ink p-1">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" data-active={view === v.id} onClick={() => setView(v.id)} className={`h-10 flex-1 ${chipSlide(view === v.id)}`}>
                {v.label}
                {v.id === "bulk" && compare.totalNeeded > 0 && (
                  <span className={`ml-1 ${view === v.id ? "text-on-accent/70" : "text-ok"}`}>
                    {compare.totalHave}/{compare.totalNeeded}
                  </span>
                )}
              </button>
            ))}
          </SlideGroup>

          {view !== "bulk" && <RulesPanel checks={rules.checks} problems={rules.problems} legal={rules.legal} stale={!ruleData} />}

          {view === "list" && (
            <ListView
              // the champion fills 1 of the 40, so the main zone needs 39 with it placed
              zones={ZONES.map((z) => (z.id === "main" ? { ...z, target: LIMITS.main - Math.min(1, countOf("champion")) } : z))}
              rowsByZone={rowsByZone}
              countOf={countOf}
              canChampion={(card) => belongsInPool(card, "champion", legend)}
              versionsOf={(card) => index.byKey.get(cardKey(card))?.length ?? 1}
              ownedOf={ownedOf}
              neededOf={neededOf}
              preview={preview}
              onInspect={setInspectCard}
              onPickPrinting={(row) => setPrintingRow(row)}
              onAdjust={(row, d) => tryAdjust(row.card, row.entry.zone, d)}
              onMove={moveOne}
            />
          )}
          {view === "art" && <ArtView zones={ZONES} rowsByZone={rowsByZone} ownedOf={ownedOf} neededOf={neededOf} preview={preview} onInspect={setInspectCard} onAdjust={(row, d) => tryAdjust(row.card, row.entry.zone, d)} />}
          {view === "stats" && <DeckStats rows={allRows} legal={rules.legal} deckId={id} ownedOf={ownedOf} />}
          {view === "bulk" && (
            <BulkView
              compare={compare}
              hasCards={entries.length > 0}
              includeRunes={includeRunes}
              onIncludeRunes={setIncludeRunes}
              includeSideboard={includeSideboard}
              onIncludeSideboard={setIncludeSideboard}
              onWants={() => setWantsOpen(true)}
              preview={preview}
              onInspect={setInspectCard}
            />
          )}
          {view !== "bulk" && allRows.length === 0 && (
            <p className="mt-4 text-center text-sm text-t3">
              Tap cards on the left to build your deck — start with a <b className="text-brand-gold">legend</b>.
            </p>
          )}
        </section>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <p role="alert" className="animate-card-in rounded-lg border border-bad/50 bg-panel px-5 py-3 text-sm text-t1">
            ⚠ {notice}
          </p>
        </div>
      )}

      {previewNode}

      {inspectCard && <CardDetailModal card={inspectCard} onClose={() => setInspectCard(null)} />}

      {wantsOpen && (
        <WantsModal
          title="Cardmarket wants list"
          fileName={`${name} - wants`}
          intro="The cards this deck needs that aren't in your bulk or binders, in the regular version."
          text={cardmarketWants(
            compare.missing.map((m) => ({ card: index.byKey.get(m.key)?.[0] ?? m.card, qty: m.qty })),
            cards
          )}
          onClose={() => setWantsOpen(false)}
        />
      )}

      {printingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={() => setPrintingRow(null)}>
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-line2 bg-panel p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-t1">{displayName(printingRow.card)} - versions</h3>
              <button onClick={() => setPrintingRow(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-t2 hover:border-line2 hover:text-t1">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(index.byKey.get(cardKey(printingRow.card)) ?? []).map((c) => {
                const on = c.id === printingRow.entry.cardId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setPrinting(printingRow, c.id);
                      setPrintingRow(null);
                    }}
                    className={`rounded-lg p-1.5 text-left transition ${on ? "bg-cavity ring-2 ring-brand-gold" : "hover:bg-panel2"}`}
                  >
                    <CardArt card={c} sizes="160px" className="rounded" />
                    <p className="mt-1 text-xs font-semibold text-t1">{PRINTING_LABEL[printingKind(c)]}</p>
                    <p className="text-[11px] text-t3">
                      {c.publicCode} · {c.set.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modal === "export" && (
        <DeckTextModal mode="export" initialText={exportDeck({ entries }, cardById)} fileName={name} onClose={() => setModal(null)} />
      )}
      {modal === "import" && (
        <DeckTextModal
          mode="import"
          onClose={() => setModal(null)}
          onImport={(text) => {
            const parsed = parseDeck(text, index);
            if (!parsed.entries.length) {
              return `No cards recognised.${parsed.unknown.length ? `\n${parsed.unknown.slice(0, 8).join("\n")}` : ""}`;
            }
            if (entries.length && !confirm("Replace the current deck with the imported list?")) return "Import cancelled.";
            change(() => parsed.entries);
            if (parsed.unknown.length) {
              alert(`Imported. ${parsed.unknown.length} line(s) not recognised:\n${parsed.unknown.slice(0, 12).join("\n")}`);
            }
            return null;
          }}
        />
      )}
    </div>
  );
}
