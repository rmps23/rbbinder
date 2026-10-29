"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "./AppDataProvider";
import { CardArt } from "./DeckViews";
import { DOMAIN_OPTIONS } from "@/lib/constants";
import { displayName, ZONES } from "@/lib/deck";
import { domainColor } from "@/lib/style";
import type { LegendOption, MetaOption, Recommendation, Style } from "@/lib/deckAdvisor";

const STYLES: { id: Style; label: string }[] = [
  { id: "any", label: "Best fit" },
  { id: "aggro", label: "Aggro" },
  { id: "midrange", label: "Midrange" },
  { id: "control", label: "Control" },
];

const WAIT = ["Reading your collection…", "Comparing with the meta list…", "Finding replacements…", "Checking the rules…"];

type Meta = { fetchedAt: string; events: { title: string; date: string; url: string }[]; decks: MetaOption[] };

const label = "font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40";
const shortDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const eventName = (title: string) => title.replace(/[’']s? Top Decks$/i, "").replace(/^From .*?,\s*/i, "");

export function DeckAdvisorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { cards } = useAppData();
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const [tab, setTab] = useState<"meta" | "legend">("meta");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  // meta tab
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaQuery, setMetaQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  // legend tab
  const [options, setOptions] = useState<LegendOption[] | null>(null);
  const [legendId, setLegendId] = useState("");
  const [style, setStyle] = useState<Style>("any");
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");

  async function loadMeta(refresh = false) {
    setMetaLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/decks/meta${refresh ? "?refresh=1" : ""}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Couldn't load the meta decks");
      setMeta(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the meta decks");
    } finally {
      setMetaLoading(false);
    }
  }

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (tab !== "legend" || options) return;
    fetch("/api/decks/recommend")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        setOptions(data);
        setLegendId(data.find((o: LegendOption) => o.owned && o.viable)?.legendId ?? data[0]?.legendId ?? "");
      })
      .catch((e) => setError(e.message));
  }, [tab, options]);

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

  async function generate(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    setRec(null);
    try {
      const res = await fetch("/api/decks/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, note }),
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

  // ---- meta lists, split by whether you own the legend
  const metaShown = useMemo(() => {
    const q = metaQuery.trim().toLowerCase();
    const list = (meta?.decks ?? []).filter(
      (d) => !q || `${d.legendName} ${d.player} ${d.champion ?? ""} ${d.event}`.toLowerCase().includes(q)
    );
    return { mine: list.filter((d) => d.legendOwned), other: list.filter((d) => !d.legendOwned) };
  }, [meta, metaQuery]);

  // ---- legends, split the same way
  const legendsShown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (options ?? []).filter(
      (o) => (!q || o.name.toLowerCase().includes(q)) && (!domain || o.domains.some((d) => d.toLowerCase() === domain))
    );
    return { mine: list.filter((o) => o.owned), other: list.filter((o) => !o.owned) };
  }, [options, query, domain]);
  const chosen = options?.find((o) => o.legendId === legendId);

  const tabBtn = (id: "meta" | "legend", text: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
        tab === id ? "bg-brand-gold text-ink" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {text}
    </button>
  );

  const MetaRow = ({ d }: { d: MetaOption }) => {
    const legend = cardById.get(d.legendId);
    const pct = d.total ? d.have / d.total : 0;
    return (
      <li className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-panel2 p-2.5">
        {legend && <CardArt card={legend} sizes="56px" className="w-11 shrink-0 rounded" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {d.legendName}
            {d.champion && <span className="font-normal text-white/45"> · {d.champion}</span>}
          </p>
          <p className="truncate text-[11px] text-white/45">
            {eventName(d.event)} {shortDate(d.date)} · {d.player} · {d.placement}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/10">
              <div className="h-full rounded-sm bg-brand-gold" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="shrink-0 text-[11px] text-white/60" title={d.missing.map((m) => `${m.qty}× ${m.name}`).join("\n")}>
              you have {d.have}/{d.total}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => generate({ metaId: d.id })}
          className="shrink-0 rounded-md bg-brand-gold px-3 py-2 text-[11px] font-semibold text-ink transition hover:bg-brand-goldSoft active:scale-95 disabled:opacity-50"
        >
          Build with my cards
        </button>
      </li>
    );
  };

  const LegendTile = ({ o }: { o: LegendOption }) => {
    const card = cardById.get(o.imageCardId);
    const on = o.legendId === legendId;
    return (
      <button
        type="button"
        onClick={() => setLegendId(o.legendId)}
        className={`relative rounded-lg p-1 text-left transition active:scale-95 ${on ? "bg-white/[0.08] ring-2 ring-brand-gold" : "hover:bg-white/[0.05]"}`}
      >
        {card && <CardArt card={card} sizes="120px" className={`rounded ${o.viable ? "" : "opacity-60"}`} />}
        <p className="mt-1 truncate text-[11px] font-semibold text-white/85" title={o.name}>
          {o.name}
        </p>
        <p className="flex items-center gap-1 text-[10px] text-white/45">
          {o.domains.map((d) => (
            <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: domainColor(d.toLowerCase()) }} />
          ))}
          {o.poolCopies} cards
        </p>
      </button>
    );
  };

  const metaLimit = showAll ? Infinity : 12;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deck from my cards"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-panel p-5 shadow-2xl animate-card-in sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">Deck from my cards</h2>
            <p className="mt-1 text-sm text-white/50">
              Uses your bulk and your binders - regular printings only (alt arts, overnumbered, signature and showcase cards stay in the binder).
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>

        {!rec && (
          <>
            <div className="mb-4 flex gap-1 rounded-lg bg-ink/60 p-1">
              {tabBtn("meta", "Meta decks")}
              {tabBtn("legend", "Pick a legend")}
            </div>

            <label className="mb-4 flex flex-col gap-1.5">
              <span className={label}>Anything else? (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="e.g. keep it cheap, avoid gear"
                className="rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
              />
            </label>

            {busy && (
              <p className="mb-4 rounded-md bg-white/[0.05] px-3 py-2.5 text-sm text-white/70">
                {WAIT[tick % WAIT.length]}
              </p>
            )}

            {tab === "meta" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
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
                    onClick={() => loadMeta(true)}
                    disabled={metaLoading}
                    className="rounded-md border border-white/10 px-2.5 py-1 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {metaLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>
                <input
                  value={metaQuery}
                  onChange={(e) => setMetaQuery(e.target.value)}
                  placeholder="Search a legend, champion or player…"
                  className="rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
                />
                {!meta && metaLoading && <p className="py-6 text-center text-sm text-white/40">Reading Riot&apos;s latest event decklists…</p>}
                {meta && (
                  <>
                    <section>
                      <h3 className={`${label} mb-2`}>With legends you own ({metaShown.mine.length})</h3>
                      {metaShown.mine.length === 0 ? (
                        <p className="text-xs text-white/35">None of these meta legends is in your bulk or binders yet.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {metaShown.mine.slice(0, metaLimit).map((d) => (
                            <MetaRow key={d.id} d={d} />
                          ))}
                        </ul>
                      )}
                    </section>
                    <section>
                      <h3 className={`${label} mb-2 mt-2`}>Legends you don&apos;t own yet ({metaShown.other.length})</h3>
                      <ul className="flex flex-col gap-2">
                        {metaShown.other.slice(0, metaLimit).map((d) => (
                          <MetaRow key={d.id} d={d} />
                        ))}
                      </ul>
                    </section>
                    {!showAll && (metaShown.mine.length > 12 || metaShown.other.length > 12) && (
                      <button type="button" onClick={() => setShowAll(true)} className="rounded-md border border-white/10 py-2 text-xs text-white/60 hover:bg-white/5">
                        Show all decks
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "legend" && (
              <div className="flex flex-col gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a legend or champion (e.g. Evelynn)…"
                  className="rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
                />
                <div className="flex flex-wrap gap-1">
                  {DOMAIN_OPTIONS.filter((d) => d.id !== "colorless").map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDomain(domain === d.id ? "" : d.id)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        domain === d.id ? "bg-white/15 text-white" : "bg-white/[0.04] text-white/55 hover:bg-white/10"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: domainColor(d.id) }} />
                      {d.label}
                    </button>
                  ))}
                </div>
                {options === null ? (
                  <p className="py-6 text-center text-sm text-white/40">Looking through your cards…</p>
                ) : (
                  <div className="max-h-[42vh] overflow-y-auto pr-1">
                    <h3 className={`${label} mb-2`}>Your legends ({legendsShown.mine.length})</h3>
                    {legendsShown.mine.length === 0 ? (
                      <p className="mb-3 text-xs text-white/35">No legend in your bulk or binders.</p>
                    ) : (
                      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {legendsShown.mine.map((o) => (
                          <LegendTile key={o.legendId} o={o} />
                        ))}
                      </div>
                    )}
                    <h3 className={`${label} mb-2`}>Other legends ({legendsShown.other.length})</h3>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {legendsShown.other.map((o) => (
                        <LegendTile key={o.legendId} o={o} />
                      ))}
                    </div>
                  </div>
                )}
                {chosen && (
                  <p className="rounded-md bg-white/[0.04] px-3 py-2 text-xs text-white/60">
                    <b className="text-white">{chosen.name}</b> · {chosen.poolCopies} playable cards you own
                    {chosen.poolCopies < 39 ? " (the deck will be short)" : ""} ·{" "}
                    {chosen.champions > 0
                      ? `${chosen.champions} champion option${chosen.champions === 1 ? "" : "s"} owned`
                      : `no champion owned - the AI picks one of ${chosen.championsInGame}`}
                    {!chosen.owned && " · you'd need the legend card"}
                  </p>
                )}
                <div>
                  <span className={label}>Play style</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStyle(s.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          style === s.id ? "bg-brand-gold text-ink" : "bg-white/[0.05] text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => generate({ legendId, style })}
                  disabled={busy || !legendId}
                  className="h-11 rounded-md bg-brand-gold font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? WAIT[tick % WAIT.length] : "Build my deck"}
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-4 rounded-md bg-brand-red/10 px-3 py-2 text-sm text-brand-red">⚠ {error}</p>}

        {rec && (
          <div className="animate-card-in">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold text-white">{rec.deckName}</h3>
              {rec.archetype && <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-white/80">{rec.archetype}</span>}
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${rec.legal ? "bg-emerald-400/15 text-emerald-300" : "bg-brand-red/15 text-brand-red"}`}>
                {rec.legal ? "✓ Legal deck" : "Needs fixing"}
              </span>
            </div>
            {rec.basedOn && <p className="mb-2 text-xs text-white/45">Based on {rec.basedOn}</p>}
            <p className="mb-3 text-sm leading-relaxed text-white/75">{rec.plan}</p>
            {rec.tips.length > 0 && (
              <ul className="mb-4 space-y-1 text-sm text-white/60">
                {rec.tips.map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            )}
            {rec.swaps.length > 0 && (
              <div className="mb-4 rounded-md border border-white/[0.07] px-3 py-2">
                <p className={`${label} mb-1.5`}>Swaps from the meta list</p>
                <ul className="space-y-1 text-xs text-white/65">
                  {rec.swaps.map((s) => (
                    <li key={`${s.out}>${s.in}`}>
                      <span className="text-white/40 line-through">{s.out}</span> → <b className="text-white/85">{s.in}</b>
                      <span className="text-white/40"> - {s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rec.missing.length > 0 && (
              <p className="mb-4 rounded-md bg-white/[0.04] px-3 py-2 text-xs text-white/60">You'd still need: {rec.missing.join(", ")}</p>
            )}
            {rec.problems.length > 0 && (
              <ul className="mb-4 rounded-md bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
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
                  <h4 className={`${label} mb-2`}>
                    {zone.label} <span className="text-white/30">{total}</span>
                  </h4>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {rows.map((e) => {
                      const card = cardById.get(e.cardId);
                      if (!card) return null;
                      return (
                        <div key={`${e.zone}:${e.cardId}`} title={displayName(card)}>
                          <div className="relative">
                            <CardArt card={card} sizes="100px" className="rounded" />
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
                className="flex-1 rounded-md bg-brand-gold py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & open in deck builder"}
              </button>
              <button
                onClick={() => setRec(null)}
                className="rounded-md border border-white/15 px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/5"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
