"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { DeckTextModal } from "./DeckTextModal";
import { ArtView, BulkView, CardArt, DomainDots, ListView, Pip, RulesPanel, StatsView, primaryColor, type CompareData, type Row } from "./DeckViews";
import { DOMAIN_OPTIONS } from "@/lib/constants";
import { availableFinishes } from "@/lib/cardFinish";
import { buildDeckIndex, cardKey, displayName, exportDeck, neededByKey, parseDeck, ZONES } from "@/lib/deck";
import { belongsInPool, checkDeck, hasRuleData, LIMITS, whyNot } from "@/lib/deckRules";
import { domainColor } from "@/lib/style";
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
  { id: "bulk", label: "Bulk" },
];

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
    on ? "bg-brand-gold text-ink shadow-[0_0_14px_-2px_rgb(var(--accent)/0.7)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
  }`;

function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90 shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        className={pct >= 100 ? "stroke-emerald-400" : "stroke-brand-gold"}
        strokeWidth="5"
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

  const [poolZone, setPoolZone] = useState<DeckZone>("legend");
  const [search, setSearch] = useState("");
  const [domainId, setDomainId] = useState("");
  const [setId, setSetId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyBulk, setOnlyBulk] = useState(false);
  const [visible, setVisible] = useState(STEP);
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

  const ownedByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const b = bulk[c.id];
      if (!b) continue;
      const q = (b.normal ?? 0) + (b.foil ?? 0);
      if (q > 0) m.set(cardKey(c), (m.get(cardKey(c)) ?? 0) + q);
    }
    return m;
  }, [cards, bulk]);

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
      entries.filter((e) => includeRunes || e.zone !== "rune"),
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
  }, [entries, includeRunes, cardById, ownedByKey, cheapest]);

  // ---------- the card pool ----------

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: RiftCard[] = [];
    for (const list of index.byKey.values()) {
      const rep = list[0];
      if (!belongsInPool(rep, poolZone, legend)) continue;
      if (q && !displayName(rep).toLowerCase().includes(q) && !list.some((c) => c.publicCode.toLowerCase().includes(q))) continue;
      if (domainId && !rep.domains.some((d) => d.id === domainId)) continue;
      if (setId && !list.some((c) => c.set.id === setId)) continue;
      if (onlyBulk && !ownedByKey.has(cardKey(rep))) continue;
      out.push(rep);
    }
    return out.sort((a, b) => (a.energy ?? 0) - (b.energy ?? 0) || a.name.localeCompare(b.name));
  }, [index, poolZone, search, domainId, setId, legend, onlyBulk, ownedByKey]);

  useEffect(() => setVisible(STEP), [poolZone, search, domainId, setId, onlyBulk]);

  const inZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsByZone.get(poolZone) ?? []) m.set(cardKey(r.card), (m.get(cardKey(r.card)) ?? 0) + r.entry.qty);
    return m;
  }, [rowsByZone, poolZone]);

  if (loadError) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-red-300">{loadError}</p>
        <Link href="/decks" className="text-brand-gold underline">
          Back to decks
        </Link>
      </div>
    );
  }
  if (loading || !deck) return <p className="py-10 text-center text-white/40">Loading deck...</p>;

  const accent = "linear-gradient(90deg, rgb(var(--accent)), rgb(var(--mint)))";
  const tgt = (z: DeckZone) => ZONES.find((x) => x.id === z)!;
  
  return (
    <div>
      {/* header */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-3 sm:p-4">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/decks" className="text-sm text-white/50 hover:text-white">
            ←
          </Link>
          <div className="relative">
            <Ring pct={progress} />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{progress}%</span>
          </div>
          <div className="min-w-0 flex-1 basis-48">
            <input
              value={name}
              onChange={(e) => {
                dirty.current = true;
                setName(e.target.value);
              }}
              aria-label="Deck name"
              className="w-full rounded-md border border-transparent bg-transparent px-1 font-display text-xl font-semibold uppercase tracking-wide text-white outline-none hover:border-white/10 focus:border-brand-gold"
            />
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[11px] text-white/45">
              {legend ? <span style={{ color: primaryColor(legend) }}>{displayName(legend)}</span> : <span>Pick a legend to start</span>}
              <span>{mainTotal}/40 main</span>
              <span>{countOf("battlefield")}/3 battlefields</span>
              <span>{countOf("rune")}/12 runes</span>
              <span className={rules.legal ? "font-semibold text-emerald-300" : "text-white/45"}>{rules.legal ? "✓ Legal deck" : "Not legal yet"}</span>
              <span className={save === "error" ? "text-red-300" : ""}>
                {save === "saving" ? "Saving…" : save === "error" ? "Couldn't save" : "✓ Saved"}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModal("import")} className="rounded-full border-[1.5px] border-brand-gold px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-brand-gold transition hover:bg-brand-gold/10 active:scale-95">
              Import
            </button>
            <button type="button" onClick={() => setModal("export")} className="rounded-full bg-brand-gold px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft active:scale-95">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* mobile switch */}
      <div className="sticky top-[57px] z-10 mb-3 flex gap-1 rounded-full bg-ink/90 p-1 backdrop-blur lg:hidden">
        {(["pool", "deck"] as Mobile[]).map((m) => (
          <button key={m} type="button" onClick={() => setMobile(m)} className={`flex-1 ${chip(mobile === m)}`}>
            {m === "pool" ? "Cards" : `Deck · ${mainTotal}/40`}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,1fr)] lg:items-start">
        {/* ---- pool ---- */}
        <section className={`${mobile === "pool" ? "" : "hidden"} lg:block`}>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {POOL_ORDER.map((z) => {
              const z0 = tgt(z);
              return (
                <button key={z} type="button" onClick={() => setPoolZone(z)} className={`shrink-0 ${chip(poolZone === z)}`}>
                  {z0.label}
                  <span className={`ml-1.5 ${poolZone === z ? "text-ink/60" : "text-white/35"}`}>
                    {z === "main" ? mainTotal : countOf(z)}
                    {z0.target ? `/${z0.target}` : z0.max ? `/${z0.max}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-panel/70 p-2.5">
            <div className="flex gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tgt(poolZone).label.toLowerCase()} cards…`}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
              />
              <select
                value={setId}
                onChange={(e) => setSetId(e.target.value)}
                className="w-28 rounded-lg border border-white/10 bg-panel px-2 py-2 text-xs text-white/80 outline-none focus:border-brand-gold sm:w-40"
              >
                <option value="">All sets</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DOMAIN_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  title={d.label}
                  onClick={() => setDomainId(domainId === d.id ? "" : d.id)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                    domainId === d.id ? "text-ink" : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                  style={domainId === d.id ? { background: domainColor(d.id) } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: domainColor(d.id) }} />
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-white/55">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={onlyBulk} onChange={(e) => setOnlyBulk(e.target.checked)} />
                Only cards I have in bulk
              </label>
              <span className="ml-auto text-white/35">{pool.length} cards</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {pool.slice(0, visible).map((card) => {
              const qty = inZone.get(cardKey(card)) ?? 0;
              const owned = ownedByKey.get(cardKey(card)) ?? 0;
              const color = primaryColor(card);
              return (
                <div key={card.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => addFromPool(card)}
                    aria-label={`Add ${displayName(card)}`}
                    className={`block w-full rounded-xl text-left ring-2 transition duration-200 hover:-translate-y-1.5 hover:scale-[1.03] active:scale-95 ${
                      flash === card.id ? "ring-brand-gold" : qty > 0 ? "ring-brand-gold/60" : "ring-transparent hover:ring-white/30"
                    }`}
                    style={{ boxShadow: `0 8px 22px -10px ${color}` }}
                  >
                    <CardArt card={card} sizes="(max-width: 640px) 30vw, 14vw" className={`rounded-xl transition ${qty > 0 ? "" : "opacity-95"}`} />
                  </button>
                  {qty > 0 && (
                    <>
                      <span key={qty} className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-6 min-w-6 animate-pop items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-bold text-ink shadow-lg">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove one"
                        onClick={() => adjust(card, poolZone, -1)}
                        className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-base opacity-100 transition hover:bg-brand-red sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        −
                      </button>
                    </>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 px-0.5">
                    <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/70">{displayName(card)}</p>
                    {owned > 0 && <span className="shrink-0 rounded bg-brand-cyan/15 px-1 text-[10px] font-bold text-brand-cyan" title="Copies in your bulk">{owned}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 px-0.5">
                    {card.energy !== null && <Pip>{card.energy}</Pip>}
                    <DomainDots card={card} />
                  </div>
                </div>
              );
            })}
          </div>
          {pool.length === 0 && (
            <p className="py-12 text-center text-sm text-white/40">
              {legend || poolZone === "legend" ? "No cards match." : "Pick a legend first - the other cards depend on its domains."}
            </p>
          )}
          {pool.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + STEP)}
              className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/60 transition hover:bg-white/5"
            >
              Show more ({pool.length - visible} left)
            </button>
          )}
        </section>

        {/* ---- workspace ---- */}
        <section
          className={`${mobile === "deck" ? "" : "hidden"} rounded-2xl border border-white/[0.07] bg-panel p-3 sm:p-4 lg:sticky lg:top-[76px] lg:block lg:max-h-[calc(100vh-92px)] lg:overflow-y-auto`}
        >
          <div className="mb-4 flex gap-1 rounded-full bg-ink/60 p-1">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" onClick={() => setView(v.id)} className={`flex-1 ${chip(view === v.id)}`}>
                {v.label}
                {v.id === "bulk" && compare.totalNeeded > 0 && (
                  <span className={`ml-1 ${view === v.id ? "text-ink/60" : "text-brand-cyan"}`}>
                    {compare.totalHave}/{compare.totalNeeded}
                  </span>
                )}
              </button>
            ))}
          </div>

          {view !== "bulk" && <RulesPanel checks={rules.checks} problems={rules.problems} legal={rules.legal} stale={!ruleData} />}

          {view === "list" && (
            <ListView
              // the champion fills 1 of the 40, so the main zone needs 39 with it placed
              zones={ZONES.map((z) => (z.id === "main" ? { ...z, target: LIMITS.main - Math.min(1, countOf("champion")) } : z))}
              rowsByZone={rowsByZone}
              countOf={countOf}
              canChampion={(card) => belongsInPool(card, "champion", legend)}
              onAdjust={(row, d) => tryAdjust(row.card, row.entry.zone, d)}
              onMove={moveOne}
            />
          )}
          {view === "art" && <ArtView zones={ZONES} rowsByZone={rowsByZone} onAdjust={(row, d) => tryAdjust(row.card, row.entry.zone, d)} />}
          {view === "stats" && <StatsView rows={allRows} />}
          {view === "bulk" && (
            <BulkView compare={compare} hasCards={entries.length > 0} includeRunes={includeRunes} onIncludeRunes={setIncludeRunes} />
          )}
          {view !== "bulk" && allRows.length === 0 && (
            <p className="mt-4 text-center text-sm text-white/35">
              Tap cards on the left to build your deck — start with a <b className="text-brand-gold">legend</b>.
            </p>
          )}
        </section>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <p className="animate-card-in rounded-full border border-brand-red/40 bg-ink/95 px-5 py-2.5 text-sm text-white shadow-2xl backdrop-blur">
            ⚠ {notice}
          </p>
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
