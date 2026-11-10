"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { Select } from "@/components/Select";
import { typicalFinish } from "@/lib/cardFinish";
import { computeStats, scoreDeck, type DeckStatsData, type Kind, type StatRow } from "@/lib/deckStats";
import { formatEur } from "@/lib/format";
import { domainColor, rarityColor, titleCase } from "@/lib/style";
import type { Deck, RiftCard } from "@/lib/types";

const KIND_COLOR: Record<Kind, string> = { unit: "rgb(var(--accent))", spell: "#c08be8", gear: "rgb(var(--warn))" };
const KIND_LABEL: Record<Kind, string> = { unit: "Units", spell: "Spells", gear: "Gear" };
const GRADE_COLOR: Record<string, string> = { S: "#F5B84B", A: "#3DD6A0", B: "rgb(74 192 222)", C: "#A6ADB5", D: "#FF6B7A" };
const CHART_H = 112;

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-ink p-4">
      <h3 className="mb-3 flex items-center justify-between gap-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1">
        {title}
        {aside && <span className="num text-xs font-normal normal-case tracking-normal text-t3">{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

// verdict: >0 the first deck is better, <0 worse, 0/undefined: just a difference (no judgement)
function Delta({ a, b, digits = 0, verdict }: { a: number | null; b: number | null; digits?: number; verdict?: number }) {
  if (a === null || b === null) return <span className="text-t3">–</span>;
  const d = a - b;
  if (Math.abs(d) < Math.pow(10, -digits) / 2) return <span className="text-t3">=</span>;
  const tone = !verdict ? "text-t1" : verdict > 0 ? "text-ok" : "text-bad";
  return (
    <span className={`font-semibold ${tone}`}>
      {d > 0 ? "▲ +" : "▼ −"}
      {Math.abs(d).toFixed(digits)}
    </span>
  );
}

function Bar({ pct, color, h = "h-2" }: { pct: number; color: string; h?: string }) {
  return (
    <div className={`${h} overflow-hidden rounded-sm bg-cavity`}>
      <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3 py-2.5">
      <p className="label">{label}</p>
      <p className="num mt-1 font-display text-2xl font-bold leading-none text-t1">{value}</p>
      {sub && <p className="num mt-1 text-[11px] text-t3">{sub}</p>}
    </div>
  );
}

function Medal({ on, label, hint }: { on: boolean; label: string; hint: string }) {
  return (
    <span
      title={`${hint}${on ? "" : " (not yet)"}`}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
        on ? "border-warn/50 bg-warn/10 text-warn" : "border-line text-t3"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        {on ? <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9L12 3Z" /> : <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z" />}
      </svg>
      {label}
      <span className="sr-only">{on ? " (earned)" : " (locked)"}</span>
    </span>
  );
}

export function DeckStats({
  rows,
  legal,
  deckId,
  ownedOf,
}: {
  rows: StatRow[];
  legal: boolean;
  deckId: string;
  ownedOf: (card: RiftCard) => number;
}) {
  const { cards, priceOf } = useAppData();
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const s = useMemo(() => computeStats(rows), [rows]);
  const { scores, overall, grade } = useMemo(() => scoreDeck(s), [s]);

  // ---- ownership & value of the 40 --------------------------------------------------------------------------
  const own = useMemo(() => {
    let need = 0;
    let have = 0;
    let value = 0;
    for (const { entry, card } of rows) {
      if (entry.zone !== "main" && entry.zone !== "champion") continue;
      need += entry.qty;
      have += Math.min(entry.qty, ownedOf(card));
      value += (priceOf(card, typicalFinish(card)) ?? 0) * entry.qty;
    }
    return { need, have, pct: need ? (have / need) * 100 : 0, value };
  }, [rows, ownedOf, priceOf]);

  // ---- compare with another saved deck ----------------------------------------------------------------------
  const [decks, setDecks] = useState<Deck[]>([]);
  const [otherId, setOtherId] = useState("");
  useEffect(() => {
    fetch("/api/decks")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Deck[]) => setDecks(d.filter((x) => x.id !== deckId)))
      .catch(() => {});
  }, [deckId]);
  const other = useMemo(() => {
    const d = decks.find((x) => x.id === otherId);
    if (!d) return null;
    const orows: StatRow[] = [];
    for (const entry of d.entries) {
      const card = cardById.get(entry.cardId);
      if (card) orows.push({ entry, card });
    }
    const st = computeStats(orows);
    return { name: d.name, s: st, score: scoreDeck(st) };
  }, [decks, otherId, cardById]);

  // ---- derived -----------------------------------------------------------------------------------------------
  const pct = (n: number) => (s.total ? (n / s.total) * 100 : 0);
  const peak = Math.max(1, ...s.curve, ...(other?.s.curve ?? [0]));
  const mightPeak = Math.max(1, ...s.mightCurve);
  const pips = [...s.powerByDomain.values()].reduce((n, d) => n + d.pips, 0);
  const runes = [...s.powerByDomain.values()].reduce((n, d) => n + d.runes, 0);
  const domainList = [...s.powerByDomain.entries()].sort((a, b) => b[1].pips - a[1].pips);
  const keywordList = [...s.keywords].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);

  const medals = [
    { id: "legal", label: "Legal", hint: "The deck follows every rule", on: legal },
    { id: "full", label: "Full deck", hint: "All 40 cards are in", on: s.total >= 40 },
    { id: "curve", label: "Smooth curve", hint: "Curve score of 85 or more", on: scores[0].value >= 85 },
    { id: "mana", label: "Rune-perfect", hint: "12 runes that follow your power needs", on: scores[1].value >= 95 && s.runeTotal === 12 },
    { id: "balance", label: "Balanced", hint: "Balance score of 85 or more", on: scores[2].value >= 85 },
    { id: "bf", label: "Battle-ready", hint: "3 battlefields chosen", on: s.battlefields >= 3 },
    { id: "own", label: "Collector", hint: "You own every card of the deck", on: own.need > 0 && own.have >= own.need },
  ];
  const earned = medals.filter((m) => m.on).length;

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-t3">Add cards to see the stats of your deck.</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* scorecard */}
      <section className="rounded-xl border border-line bg-ink p-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2"
            style={{ borderColor: GRADE_COLOR[grade], color: GRADE_COLOR[grade] }}
            role="img"
            aria-label={`Deck grade ${grade}, ${overall} out of 100`}
          >
            <span className="font-display text-4xl font-bold leading-none">{grade}</span>
            <span className="num mt-1 text-[11px] font-semibold text-t2">{overall}/100</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="label">Deck score</p>
            <p className="mt-1 text-sm text-t2">A rough guide from the curve, mana base, balance and completeness. {earned}/{medals.length} medals earned.</p>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
          {scores.map((sc) => (
            <li key={sc.id} title={sc.hint}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-t2">{sc.label}</span>
                <span className="num font-semibold text-t1">{sc.value}</span>
              </div>
              <Bar pct={sc.value} color={sc.value >= 80 ? "rgb(var(--mint))" : sc.value >= 55 ? "rgb(var(--accent))" : "rgb(var(--warn))"} />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {medals.map((m) => (
            <Medal key={m.id} on={m.on} label={m.label} hint={m.hint} />
          ))}
        </div>
      </section>

      {/* key numbers */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Avg energy" value={s.avgEnergy === null ? "–" : s.avgEnergy.toFixed(1)} />
        <Tile label="Avg power" value={s.avgPower === null ? "–" : s.avgPower.toFixed(1)} sub="coloured cards" />
        <Tile label="Avg might" value={s.avgMight === null ? "–" : s.avgMight.toFixed(1)} sub="units" />
        <Tile label="Cheap ≤2" value={String(s.cheap)} sub={`${Math.round(pct(s.cheap))}% of deck`} />
        <Tile label="Mid 3-4" value={String(s.mid)} sub={`${Math.round(pct(s.mid))}% of deck`} />
        <Tile label="Top 5+" value={String(s.top)} sub={`${Math.round(pct(s.top))}% of deck`} />
      </div>

      {/* compare control */}
      {decks.length > 0 && (
        <Panel title="Compare">
          <Select
            value={otherId}
            onChange={setOtherId}
            ariaLabel="Compare with another deck"
            searchPlaceholder="Search decks…"
            className="h-11 text-sm"
            options={[{ value: "", label: "No comparison" }, ...decks.map((d) => ({ value: d.id, label: d.name }))]}
            searchable={decks.length > 6}
            menuMinWidth={240}
          />
          {other && (
            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 bg-panel2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-t3">
                <span>Metric</span>
                <span className="w-10 text-right">This</span>
                <span className="w-14 truncate text-right" title={other.name}>{other.name}</span>
                <span className="w-14 text-right">Diff</span>
              </div>
              {(
                [
                  ["Score", overall, other.score.overall, 0, (x, y) => x - y],
                  // nearer to 3 is better, like the score's curve rule
                  ["Avg energy", s.avgEnergy, other.s.avgEnergy, 1, (x, y) => Math.abs(y - 3) - Math.abs(x - 3)],
                  ["Cheap ≤2", s.cheap, other.s.cheap, 0, (x, y) => x - y],
                  ["Top 5+", s.top, other.s.top, 0, (x, y) => y - x],
                  // closer to half units is better
                  ["Units", s.kinds.unit, other.s.kinds.unit, 0, (x, y) => Math.abs(y / Math.max(1, other.s.total) - 0.5) - Math.abs(x / Math.max(1, s.total) - 0.5)],
                  ["Spells", s.kinds.spell, other.s.kinds.spell, 0, null],
                  ["Gear", s.kinds.gear, other.s.kinds.gear, 0, null],
                  ["Avg power", s.avgPower, other.s.avgPower, 1, null],
                  ["Avg might", s.avgMight, other.s.avgMight, 1, null],
                ] as [string, number | null, number | null, number, ((x: number, y: number) => number) | null][]
              ).map(([label, a, b, digits, judge]) => (
                <div key={label} className="num grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-t border-line px-3 py-2 text-sm">
                  <span className="text-t2">{label}</span>
                  <span className="w-10 text-right font-semibold text-t1">{a === null ? "–" : a.toFixed(digits)}</span>
                  <span className="w-14 text-right text-t2">{b === null ? "–" : b.toFixed(digits)}</span>
                  <span className="w-14 text-right text-xs">
                    <Delta a={a} b={b} digits={digits} verdict={judge && a !== null && b !== null ? judge(a, b) : undefined} />
                  </span>
                </div>
              ))}
              <p className="border-t border-line px-3 py-2 text-[11px] leading-snug text-t3">
                <span className="font-semibold text-ok">Green</span> = better, <span className="font-semibold text-bad">red</span> = worse, by the deck score&apos;s rules (energy near 3, more cheap cards, fewer top-end, about half units). Grey rows are just differences.
              </p>
            </div>
          )}
        </Panel>
      )}

      {/* energy curve */}
      <Panel title="Energy curve" aside={other ? `dashes: ${other.name}` : undefined}>
        <div className="flex items-end gap-2" role="img" aria-label={`Energy curve: ${s.curve.map((n, i) => `${n} at ${i === 7 ? "7 or more" : i}`).join(", ")}`}>
          {s.curve.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="num h-4 text-xs font-semibold text-t2">{n || ""}</span>
              <div className="relative flex w-full flex-col-reverse justify-start" style={{ height: CHART_H }}>
                {(["unit", "spell", "gear"] as Kind[]).map((k) => {
                  const v = s.curveByKind[k][i];
                  return v ? <div key={k} className="w-full first:rounded-b-sm last:rounded-t-md" style={{ height: Math.max(3, (v / peak) * CHART_H), background: KIND_COLOR[k] }} /> : null;
                })}
                {other && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t-2 border-dashed border-t1/70"
                    style={{ bottom: Math.round((other.s.curve[i] / peak) * CHART_H) }}
                  />
                )}
              </div>
              <span className="num flex h-6 min-w-6 items-center justify-center rounded-md bg-cavity px-1 text-[11px] font-bold text-t1">{i === 7 ? "7+" : i}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-t2">
          {(["unit", "spell", "gear"] as Kind[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} aria-hidden="true" />
              {KIND_LABEL[k]} <b className="num text-t1">{s.kinds[k]}</b>
            </li>
          ))}
        </ul>
      </Panel>

      {/* might */}
      {s.kinds.unit > 0 && (
        <Panel title="Unit might" aside={s.avgMight !== null ? `avg ${s.avgMight.toFixed(1)}` : undefined}>
          <div className="flex items-end gap-2" role="img" aria-label={`Unit might: ${s.mightCurve.map((n, i) => `${n} at ${i === 7 ? "7 or more" : i}`).join(", ")}`}>
            {s.mightCurve.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="num h-4 text-xs font-semibold text-t2">{n || ""}</span>
                <div className="w-full rounded-t-md bg-brand-gold" style={{ height: n ? Math.max(4, (n / mightPeak) * 56) : 0 }} />
                <span className="num flex h-6 min-w-6 items-center justify-center rounded-md bg-cavity px-1 text-[11px] font-bold text-t1">{i === 7 ? "7+" : i}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* domains, power & runes */}
      <Panel title="Domains & mana" aside={`${s.runeTotal}/12 runes`}>
        {domainList.length === 0 ? (
          <p className="text-xs text-t3">No coloured cards yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {domainList.map(([id, d]) => {
              const pipShare = pips ? (d.pips / pips) * 100 : 0;
              const runeShare = runes ? (d.runes / runes) * 100 : 0;
              const diff = runeShare - pipShare;
              const status = runes === 0 ? "No runes" : diff < -12 ? "Needs more runes" : diff > 12 ? "Too many runes" : "Balanced";
              const good = status === "Balanced";
              return (
                <li key={id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-t1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: domainColor(id) }} aria-hidden="true" />
                      {titleCase(id)}
                      <span className="num text-xs font-normal text-t3">{s.domains.get(id) ?? 0} cards · {d.pips} power</span>
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${good ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{good ? "✓ " : "⚠ "}{status}</span>
                  </div>
                  <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-x-2 gap-y-1 text-[11px] text-t3">
                    <span>Power</span>
                    <Bar pct={pipShare} color={domainColor(id)} h="h-1.5" />
                    <span className="num text-right">{Math.round(pipShare)}%</span>
                    <span>Runes</span>
                    <Bar pct={runeShare} color={domainColor(id)} h="h-1.5" />
                    <span className="num text-right">{d.runes}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* types + rarity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Card types">
          <ul className="flex flex-col gap-2.5">
            {(["unit", "spell", "gear"] as Kind[]).map((k) => (
              <li key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-t2">{KIND_LABEL[k]}</span>
                  <span className="num text-t1">
                    <b>{s.kinds[k]}</b> <span className="text-t3">· {Math.round(pct(s.kinds[k]))}%</span>
                  </span>
                </div>
                <Bar pct={pct(s.kinds[k])} color={KIND_COLOR[k]} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Rarity">
          <ul className="flex flex-col gap-2.5">
            {["common", "uncommon", "rare", "epic", "showcase"].map((id) => {
              const n = s.rarities.get(id) ?? 0;
              return (
                <li key={id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-t2">
                      <span className="h-2 w-2 rounded-full" style={{ background: rarityColor(id) }} aria-hidden="true" />
                      {titleCase(id)}
                    </span>
                    <span className="num font-semibold text-t1">{n}</span>
                  </div>
                  <Bar pct={pct(n)} color={rarityColor(id)} h="h-1.5" />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* keywords */}
      {keywordList.length > 0 && (
        <Panel title="Keywords">
          <ul className="flex flex-wrap gap-1.5">
            {keywordList.map(([k, n]) => (
              <li key={k} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-panel2 px-2.5 text-xs font-semibold text-t1">
                {k}
                <span className="num rounded bg-cavity px-1.5 text-[11px] text-t2">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* collection */}
      <Panel title="Your collection">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">You own</p>
            <p className="num mt-1 font-display text-2xl font-bold leading-none text-t1">
              {own.have}
              <span className="text-t3"> / {own.need}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="label">Deck value</p>
            <p className="num mt-1 text-xl font-bold leading-none text-t1">{formatEur(own.value)}</p>
          </div>
        </div>
        <div className="mt-3">
          <Bar pct={own.pct} color={own.pct >= 100 ? "rgb(var(--mint))" : "rgb(var(--accent))"} />
          <p className="num mt-1.5 text-[11px] text-t3">{Math.round(own.pct)}% of the 40 cards are in your bulk or binders</p>
        </div>
      </Panel>
    </div>
  );
}
