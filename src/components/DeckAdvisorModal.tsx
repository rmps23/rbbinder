"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "./AppDataProvider";
import { CardArt } from "./DeckViews";
import { displayName, ZONES } from "@/lib/deck";
import { DOMAIN_OPTIONS } from "@/lib/constants";
import { domainColor } from "@/lib/style";
import type { LegendOption, Recommendation, Style } from "@/lib/deckAdvisor";

const STYLES: { id: Style; label: string }[] = [
  { id: "any", label: "Best fit" },
  { id: "aggro", label: "Aggro" },
  { id: "midrange", label: "Midrange" },
  { id: "control", label: "Control" },
];

const WAIT = ["Shuffling your bulk…", "Counting runes…", "Picking a champion…", "Testing the curve…", "Checking the rules…"];

export function DeckAdvisorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { cards } = useAppData();
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const [options, setOptions] = useState<LegendOption[] | null>(null);
  const [legendId, setLegendId] = useState("");
  const [style, setStyle] = useState<Style>("any");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [onlyBuildable, setOnlyBuildable] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (options ?? []).filter(
      (o) =>
        (!q || o.name.toLowerCase().includes(q)) &&
        (!domain || o.domains.some((d) => d.toLowerCase() === domain)) &&
        (!onlyBuildable || o.viable)
    );
  }, [options, query, domain, onlyBuildable]);

  useEffect(() => {
    fetch("/api/decks/recommend")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        setOptions(data);
        setLegendId(data.find((o: LegendOption) => o.viable)?.legendId ?? data[0]?.legendId ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((n) => n + 1), 1800);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function generate() {
    setBusy(true);
    setError(null);
    setRec(null);
    try {
      const res = await fetch("/api/decks/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ legendId, style, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't build a deck");
      setRec(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build a deck");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!rec) return;
    setSaving(true);
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: rec.deckName, entries: rec.entries }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the deck");
    router.push(`/decks/${data.id}`);
  }

  const chosen = options?.find((o) => o.legendId === legendId);
  const chip = (on: boolean) =>
    `rounded-md px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
      on ? "bg-brand-gold text-ink" : "bg-white/[0.05] text-white/60 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recommend a deck"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-panel p-5 shadow-2xl animate-card-in sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">Deck from my bulk</h2>
            <p className="mt-1 text-sm text-white/50">
              A free AI (Google Gemini) builds a Nexus Night-ready deck using only the cards in your bulk - checked against the deck rules.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>

        {!rec && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Legend - any legend works, owned or not
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a legend or champion (e.g. Evelynn)…"
                  className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-ink px-4 py-2 text-sm text-white outline-none focus:border-brand-gold"
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={onlyBuildable}
                  onClick={() => setOnlyBuildable((v) => !v)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                    onlyBuildable ? "border-brand-gold bg-brand-gold/15 text-brand-gold" : "border-white/10 text-white/55"
                  }`}
                >
                  ✓ Buildable from bulk
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {DOMAIN_OPTIONS.filter((d) => d.id !== "colorless").map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    title={d.label}
                    onClick={() => setDomain(domain === d.id ? "" : d.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                      domain === d.id ? "text-ink" : "bg-white/[0.05] text-white/55 hover:bg-white/10"
                    }`}
                    style={domain === d.id ? { background: domainColor(d.id) } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: domainColor(d.id) }} />
                    {d.label}
                  </button>
                ))}
              </div>

              {options === null ? (
                <p className="py-6 text-center text-sm text-white/40">{error ? "" : "Looking through your bulk…"}</p>
              ) : shown.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/40">No legend matches.</p>
              ) : (
                <div className="-mx-1 grid max-h-[38vh] grid-cols-3 gap-2 overflow-y-auto px-1 py-1 sm:grid-cols-5">
                  {shown.map((o) => {
                    const card = cardById.get(o.imageCardId);
                    const on = o.legendId === legendId;
                    return (
                      <button
                        key={o.legendId}
                        type="button"
                        onClick={() => setLegendId(o.legendId)}
                        className={`group relative rounded-xl p-1 text-left transition active:scale-95 ${
                          on ? "bg-brand-gold/15 ring-2 ring-brand-gold" : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="relative">
                          {card && <CardArt card={card} sizes="120px" className={`rounded-lg ${o.viable ? "" : "opacity-70"}`} />}
                          {o.owned && (
                            <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 text-[9px] font-semibold text-white/85">owned</span>
                          )}
                          {o.viable && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-brand-gold text-[11px] font-bold text-ink">✓</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[11px] font-semibold text-white/85" title={o.name}>{o.name}</p>
                        <p className="flex items-center gap-1 text-[10px] text-white/45">
                          {o.domains.map((d) => (
                            <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: domainColor(d.toLowerCase()) }} />
                          ))}
                          {o.poolCopies} cards
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {chosen && (
                <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/60">
                  <b className="text-white">{chosen.name}</b> · {chosen.poolCopies} playable cards in your bulk
                  {chosen.poolCopies < 39 ? " (the deck will be short)" : ""} ·{" "}
                  {chosen.champions > 0
                    ? `${chosen.champions} champion option${chosen.champions === 1 ? "" : "s"} owned`
                    : `no champion owned - the AI picks one of ${chosen.championsInGame} for you to get`}
                  {!chosen.owned && " · you'd need the legend card"}
                </p>
              )}
            </div>

            <div>
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Play style</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={chip(style === s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Anything else? (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="e.g. lots of cheap units, avoid gear"
                className="rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-brand-gold"
              />
            </label>

            <button
              onClick={generate}
              disabled={busy || !legendId}
              className="h-12 rounded-md bg-brand-gold font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? WAIT[tick % WAIT.length] : "Build my deck"}
            </button>
            {busy && (
              <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
                <div className="h-full w-1/3 animate-shimmer rounded-md bg-white/40" style={{ backgroundSize: "200% 100%", width: "100%" }} />
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-brand-red/10 px-3 py-2 text-sm text-brand-red">⚠ {error}</p>}

        {rec && (
          <div className="animate-card-in">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold text-white">{rec.deckName}</h3>
              {rec.archetype && <span className="rounded-md bg-brand-gold/15 px-2.5 py-0.5 text-xs font-semibold text-brand-gold">{rec.archetype}</span>}
              <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${rec.legal ? "bg-emerald-400/15 text-emerald-300" : "bg-brand-red/15 text-brand-red"}`}>
                {rec.legal ? "✓ Legal deck" : "Needs fixing"}
              </span>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-white/75">{rec.plan}</p>
            {rec.tips.length > 0 && (
              <ul className="mb-4 space-y-1 text-sm text-white/60">
                {rec.tips.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            )}
            {rec.missing.length > 0 && (
              <p className="mb-4 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/60">
                Not in your bulk: {rec.missing.join(", ")}
              </p>
            )}
            {rec.problems.length > 0 && (
              <ul className="mb-4 rounded-xl bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
                {rec.problems.map((p) => (
                  <li key={p}>⚠ {p}</li>
                ))}
              </ul>
            )}

            {ZONES.map((zone) => {
              const rows = rec.entries.filter((e) => e.zone === zone.id);
              if (!rows.length) return null;
              const total = rows.reduce((n, e) => n + e.qty, 0);
              return (
                <section key={zone.id} className="mb-4">
                  <h4 className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                    {zone.label} <span className="text-white/30">{total}</span>
                  </h4>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {rows.map((e) => {
                      const card = cardById.get(e.cardId);
                      if (!card) return null;
                      return (
                        <div key={`${e.zone}:${e.cardId}`} title={displayName(card)}>
                          <div className="relative">
                            <CardArt card={card} sizes="100px" className="rounded-lg" />
                            {e.qty > 1 && (
                              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-gold px-1 text-[11px] font-bold text-ink">
                                {e.qty}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-white/60">{displayName(card)}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-white/10 bg-panel/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-md bg-brand-gold py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft active:scale-95 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & open in deck builder"}
              </button>
              <button
                onClick={() => setRec(null)}
                className="rounded-md border border-white/15 px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/5 active:scale-95"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
