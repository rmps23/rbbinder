"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { CardArt } from "./DeckViews";
import type { MetaOption } from "@/lib/metaCheck";

type Meta = { fetchedAt: string; events: { title: string; date: string; url: string }[]; decks: MetaOption[] };

const label = "font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40";
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
  const [open, setOpen] = useState<string | null>(null);

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

  // One entry per legend that shows up in the meta lists, legends you own first.
  const legends = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; imageId: string; owned: boolean; decks: number; best: number }>();
    for (const d of meta?.decks ?? []) {
      const cur = byKey.get(d.legendKey);
      const m = missingCount(d);
      if (cur) {
        cur.decks++;
        cur.best = Math.min(cur.best, m);
      } else byKey.set(d.legendKey, { key: d.legendKey, name: d.legendName, imageId: d.legendId, owned: d.legendOwned, decks: 1, best: m });
    }
    return [...byKey.values()].sort((a, b) => Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name));
  }, [meta]);

  const chosen = legends.find((l) => l.key === legendKey) ?? null;
  const decks = useMemo(() => (meta?.decks ?? []).filter((d) => d.legendKey === legendKey), [meta, legendKey]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meta decks"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-panel p-5 shadow-2xl animate-card-in sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">Meta decks</h2>
            <p className="mt-1 text-sm text-white/50">
              Pick a legend and see how many cards you&apos;re missing for each recent meta list. Counts your bulk and binders - regular printings only. Runes and
              sideboard aren&apos;t counted.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
          <span>
            From Riot&apos;s official Top Decks:{" "}
            {meta?.events.map((e, i) => (
              <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-white">
                {eventName(e.title)} ({shortDate(e.date)}){i < meta.events.length - 1 ? ", " : ""}
              </a>
            )) ?? "…"}
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-md border border-white/10 px-2.5 py-1 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="mb-3 rounded-md bg-brand-red/10 px-3 py-2 text-sm text-brand-red">⚠ {error}</p>}
        {!meta && loading && <p className="py-6 text-center text-sm text-white/40">Reading Riot&apos;s latest event decklists…</p>}

        {meta && (
          <>
            <label className="mb-4 flex flex-col gap-1.5">
              <span className={label}>Legend</span>
              <select
                value={legendKey}
                onChange={(e) => {
                  setLegendKey(e.target.value);
                  setOpen(null);
                }}
                className="rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
              >
                <option value="">Choose a legend…</option>
                <optgroup label="Legends you own">
                  {legends
                    .filter((l) => l.owned)
                    .map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.name} ({l.decks} {l.decks === 1 ? "deck" : "decks"})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Legends you don't own yet">
                  {legends
                    .filter((l) => !l.owned)
                    .map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.name} ({l.decks} {l.decks === 1 ? "deck" : "decks"})
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>

            {!chosen && <p className="py-4 text-center text-sm text-white/35">{legends.length} legends have decks in the latest events.</p>}

            {chosen && (
              <ul className="flex flex-col gap-2">
                {decks.map((d) => {
                  const legend = cardById.get(d.legendId);
                  const missing = missingCount(d);
                  const pct = d.total ? d.have / d.total : 0;
                  const isOpen = open === d.id;
                  return (
                    <li key={d.id} className="rounded-lg border border-white/[0.07] bg-panel2 p-2.5">
                      <div className="flex items-center gap-3">
                        {legend && <CardArt card={legend} sizes="56px" className="w-11 shrink-0 rounded" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {d.champion ?? d.legendName}
                            <span className="font-normal text-white/45"> · {d.player}</span>
                          </p>
                          <p className="truncate text-[11px] text-white/45">
                            <a href={d.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-white">
                              {eventName(d.event)} {shortDate(d.date)}
                            </a>{" "}
                            · {d.placement}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/10">
                              <div className={`h-full rounded-sm ${missing === 0 ? "bg-emerald-400" : "bg-brand-gold"}`} style={{ width: `${pct * 100}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] text-white/60">
                              {d.have}/{d.total}
                            </span>
                          </div>
                        </div>
                        {missing === 0 ? (
                          <span className="shrink-0 rounded-md bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">✓ You have it all</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : d.id)}
                            className="shrink-0 rounded-md bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/[0.12]"
                          >
                            {missing} missing {isOpen ? "▴" : "▾"}
                          </button>
                        )}
                      </div>
                      {isOpen && missing > 0 && (
                        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-white/[0.07] pt-2 text-xs text-white/65 sm:grid-cols-2">
                          {d.missing.map((m) => (
                            <li key={m.name}>
                              <b className="text-white/85">{m.qty}×</b> {m.name}
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
