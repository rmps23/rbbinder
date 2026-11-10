"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { CardArt } from "./DeckViews";
import { domainColor } from "@/lib/style";
import type { LegendInfo, MetaOption } from "@/lib/metaCheck";

type Meta = { fetchedAt: string; events: { title: string; date: string; url: string }[]; decks: MetaOption[]; legends: LegendInfo[] };

const label = "font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-t3";
const shortDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const eventName = (title: string) => title.replace(/[’']s? Top Decks$/i, "").replace(/^From .*?,\s*/i, "");
const missingCount = (d: MetaOption) => d.missing.reduce((n, m) => n + m.qty, 0);

export function MetaDecksModal({ onClose }: { onClose: () => void }) {
  const { cards } = useAppData();
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legendKey, setLegendKey] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ id: string; name: string; busy: boolean; error: string | null } | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({}); // meta deck id -> my deck id

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/decks/meta${refresh ? "?refresh=1" : ""}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Couldn't load the meta decks");
      setMeta(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the meta decks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Every legend in the game, with how many meta lists use it.
  const legends = useMemo(() => {
    const count = new Map<string, number>();
    for (const d of meta?.decks ?? []) count.set(d.legendKey, (count.get(d.legendKey) ?? 0) + 1);
    return (meta?.legends ?? []).map((l) => ({ ...l, decks: count.get(l.key) ?? 0 }));
  }, [meta]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = legends.filter((l) => !q || l.name.toLowerCase().includes(q));
    // with meta lists first, then the ones you own, then the rest
    return list.sort((x, y) => Number(y.decks > 0) - Number(x.decks > 0) || Number(y.owned) - Number(x.owned) || x.name.localeCompare(y.name));
  }, [legends, query]);

  const chosen = legends.find((l) => l.key === legendKey) ?? null;
  const pick = (key: string) => {
    setLegendKey(key);
    setOpen(null);
    setPickerOpen(false);
  };
  // Riot's event lists first, then the community decks, the most liked on top.
  const decks = useMemo(
    () =>
      (meta?.decks ?? [])
        .filter((d) => d.legendKey === legendKey)
        .sort((a, b) => Number(a.section === "community") - Number(b.section === "community") || (b.likes ?? 0) - (a.likes ?? 0) || b.date.localeCompare(a.date)),
    [meta, legendKey]
  );

  async function save() {
    if (!saving) return;
    const deck = meta?.decks.find((d) => d.id === saving.id);
    const name = saving.name.trim();
    if (!deck || !name) return;
    setSaving({ ...saving, busy: true, error: null });
    const res = await fetch("/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, entries: deck.entries }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setSaving({ ...saving, busy: false, error: data.error ?? "Couldn't save the deck" });
    setSaved((s) => ({ ...s, [deck.id]: data.id }));
    setSaving(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meta decks"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel p-5  animate-card-in sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Meta decks</h2>
            <p className="mt-1 text-sm text-t3">
              Pick a legend and see how many cards you&apos;re missing for each recent meta list. Counts your bulk and binders - regular printings only. Runes and
              sideboard aren&apos;t counted.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-t3 hover:bg-cavity hover:text-t1">
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-t3">
          <span>
            From Riot&apos;s official Top Decks:{" "}
            {meta?.events.map((e, i) => (
              <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-t1">
                {eventName(e.title)} ({shortDate(e.date)}){i < meta.events.length - 1 ? ", " : ""}
              </a>
            )) ?? "…"}
            {meta && (
              <>
                {" "}
                + popular community decks from{" "}
                <a href="https://piltoverarchive.com/decks" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-t1">
                  Piltover Archive
                </a>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-md border border-line px-2.5 py-1 text-t2 hover:bg-panel2 hover:text-t1 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="mb-3 rounded-md bg-brand-red/10 px-3 py-2 text-sm text-brand-red">⚠ {error}</p>}
        {!meta && loading && <p className="py-6 text-center text-sm text-t3">Reading Riot&apos;s latest event decklists…</p>}

        {meta && (
          <>
            <div className="mb-4">
              <span className={label}>Legend</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-line bg-ink px-3 py-2 focus-within:border-brand-gold">
                {chosen && !pickerOpen && cardById.get(chosen.imageId) && <CardArt card={cardById.get(chosen.imageId)!} sizes="28px" className="w-5 shrink-0 rounded-sm" />}
                <input
                  value={pickerOpen ? query : chosen?.name ?? ""}
                  onFocus={() => {
                    setQuery("");
                    setPickerOpen(true);
                  }}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filtered[0]) pick(filtered[0].key);
                    if (e.key === "Escape" && pickerOpen) {
                      e.stopPropagation();
                      setPickerOpen(false);
                    }
                  }}
                  placeholder="Search a legend or champion (e.g. Evelynn)…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-t1 outline-none placeholder:text-t3"
                />
                <button
                  type="button"
                  aria-label="Show legends"
                  onClick={() => {
                    setQuery("");
                    setPickerOpen(!pickerOpen);
                  }}
                  className="text-t3 hover:text-t1"
                >
                  {pickerOpen ? "▴" : "▾"}
                </button>
              </div>

              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  <ul className="relative z-20 mt-1.5 max-h-[min(24rem,45dvh)] overflow-y-auto rounded-lg border border-line bg-panel2 p-1 ">
                    {filtered.length === 0 && <li className="px-3 py-3 text-sm text-t3">No legend found.</li>}
                    {filtered.map((l) => {
                      const card = cardById.get(l.imageId);
                      return (
                        <li key={l.key}>
                          <button
                            type="button"
                            onClick={() => pick(l.key)}
                            className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-cavity ${l.key === legendKey ? "bg-white/[0.08]" : ""}`}
                          >
                            {card && <CardArt card={card} sizes="48px" className={`w-10 shrink-0 rounded ${l.owned ? "" : "opacity-60"}`} />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-t1">{l.name}</span>
                              <span className="flex items-center gap-1 text-[11px] text-t3">
                                {l.domains.map((dm) => (
                                  <span key={dm} className="h-1.5 w-1.5 rounded-full" style={{ background: domainColor(dm) }} />
                                ))}
                                {l.owned ? "owned" : "not owned"}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${l.decks ? "bg-brand-gold/15 text-brand-gold" : "bg-white/[0.05] text-t3"}`}>
                              {l.decks ? `${l.decks} ${l.decks === 1 ? "deck" : "decks"}` : "no meta decks"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {!chosen && <p className="py-4 text-center text-sm text-t3">{legends.filter((l) => l.decks > 0).length} of {legends.length} legends have decks in the latest events.</p>}
            {chosen && decks.length === 0 && <p className="py-4 text-center text-sm text-t3">No meta decks for {chosen.name} in the latest events.</p>}

            {chosen && (
              <ul className="flex flex-col gap-2">
                {decks.map((d) => {
                  const legend = cardById.get(d.legendId);
                  const missing = missingCount(d);
                  const pct = d.total ? d.have / d.total : 0;
                  const isOpen = open === d.id;
                  return (
                    <li key={d.id} className="rounded-lg border border-line bg-panel2 p-2.5">
                      <div className="flex items-center gap-3">
                        {legend && <CardArt card={legend} sizes="56px" className="w-11 shrink-0 rounded" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-t1">
                            {d.champion ?? d.legendName}
                            <span className="font-normal text-t3"> · {d.player}</span>
                          </p>
                          <p className="truncate text-[11px] text-t3">
                            <a href={d.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-t1">
                              {eventName(d.event)} {shortDate(d.date)}
                            </a>{" "}
                            · {d.section === "community" ? `♥ ${d.likes ?? 0} · ${d.title ?? ""}` : d.placement}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-cavity">
                              <div className={`h-full rounded-sm ${missing === 0 ? "bg-ok" : "bg-brand-gold"}`} style={{ width: `${pct * 100}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] text-t2">
                              {d.have}/{d.total}
                            </span>
                          </div>
                        </div>
                        {missing === 0 ? (
                          <span className="shrink-0 rounded-md bg-ok/15 px-2.5 py-1.5 text-[11px] font-semibold text-ok">✓ You have it all</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : d.id)}
                            className="shrink-0 rounded-md bg-cavity px-2.5 py-1.5 text-[11px] font-semibold text-t1 transition hover:bg-white/[0.12]"
                          >
                            {missing} missing {isOpen ? "▴" : "▾"}
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {saved[d.id] ? (
                          <Link href={`/decks/${saved[d.id]}`} className="text-[11px] font-semibold text-ok hover:underline">
                            ✓ Added to your decks - open it
                          </Link>
                        ) : saving?.id === d.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              save();
                            }}
                            className="flex w-full flex-wrap items-center gap-2"
                          >
                            <input
                              autoFocus
                              value={saving.name}
                              onChange={(e) => setSaving({ ...saving, name: e.target.value })}
                              maxLength={80}
                              placeholder="Deck name"
                              className="min-w-[200px] flex-1 rounded-md border border-line bg-ink px-3 py-1.5 text-sm text-t1 outline-none focus:border-brand-gold"
                            />
                            <button type="submit" disabled={saving.busy || !saving.name.trim()} className="rounded-md bg-brand-gold px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-brand-goldSoft disabled:opacity-50">
                              {saving.busy ? "Saving…" : "Save deck"}
                            </button>
                            <button type="button" onClick={() => setSaving(null)} className="rounded-md px-2 py-1.5 text-[11px] text-t3 hover:text-t1">
                              Cancel
                            </button>
                            {saving.error && <span className="w-full text-[11px] text-brand-red">⚠ {saving.error}</span>}
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSaving({ id: d.id, name: `${d.champion ?? d.legendName} - ${d.title ?? d.player}`.slice(0, 80), busy: false, error: null })}
                            className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-t2 transition hover:bg-panel2"
                          >
                            + Add to my decks
                          </button>
                        )}
                      </div>
                      {isOpen && missing > 0 && (
                        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-line pt-2 text-xs text-t2 sm:grid-cols-2">
                          {d.missing.map((m) => (
                            <li key={m.name}>
                              <b className="text-t1">{m.qty}×</b> {m.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
