"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { PageHead } from "@/components/PageHead";
import { MatchImportModal } from "@/components/MatchImportModal";
import { LegendFace, MatchRow, ResultDot, type MatchActions } from "@/components/MatchRow";
import { Select } from "@/components/Select";
import { SideboardGuide } from "@/components/SideboardGuide";
import { ListSkeleton } from "@/components/Skeletons";
import { SlideGroup } from "@/components/SlideGroup";
import { WinRing } from "@/components/WinRing";
import { buildDeckIndex, parseDeck } from "@/lib/deck";
import { deckFamilies, deckLabels, hasVersions } from "@/lib/deckVersions";
import { average, cardRows, groupBy, groupSeries, isSeries, pct, record, tally, winRate, type Row } from "@/lib/matchStats";
import type { Deck, Match, MatchResult, MatchSide, RiftCard, SidePlan } from "@/lib/types";

const PERIODS = [
  { value: "", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];
const FORMATS = [
  { value: "", label: "Bo1 and Bo3" },
  { value: "bo1", label: "Bo1 only" },
  { value: "bo3", label: "Bo3 only" },
];
const NO_DECK = "none";
const FAMILY = "family:"; // a deck with all its versions, in the deck filter
const STEP = 20;

const LAST = 12; // results shown in the summary

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="num mt-1.5 font-display text-xl font-bold leading-none text-t1">{value}</dd>
      {sub && <dd className="num mt-1.5 text-xs text-t3">{sub}</dd>}
    </div>
  );
}

const TABS = [
  { id: "legends", label: "Legends" },
  { id: "decks", label: "Decks" },
  { id: "battlefields", label: "Fields" },
  { id: "cards", label: "Cards" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const HINT: Record<Tab, string> = {
  legends: "Your win rate against each legend. Pick one to filter the games.",
  decks: "Your win rate with each deck, and each version of it. Pick one to filter the games.",
  battlefields: "Your win rate with each of your battlefields.",
  cards: "Your win rate in the games where you played the card.",
};

// Win rates one subject at a time, each with its ring. With few games the rate says little, so the record stays next to it.
function Rates({ rows, nested, art, onPick, picked }: { rows: Row[]; nested?: Map<string, Row[]>; art?: (key: string) => RiftCard | undefined; onPick?: (key: string) => void; picked?: string }) {
  const [all, setAll] = useState(false);
  const limit = 6;
  if (!rows.length) return <p className="py-6 text-center text-sm text-t3">No games yet.</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {(all ? rows : rows.slice(0, limit)).flatMap((r) => [{ r, sub: false }, ...(nested?.get(r.key) ?? []).map((x) => ({ r: x, sub: true }))]).map(({ r, sub }) => {
          const row = `flex w-full items-center gap-4 text-left ${sub ? "py-2 pl-8 pr-4" : "px-4 py-3"}`;
          const body = (
            <>
              {art && <LegendFace card={art(r.key)} />}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${sub ? "text-t2" : "text-t1"}`} title={r.label}>
                  {r.label}
                </span>
                <span className="num mt-0.5 block text-xs text-t3">
                  {r.wins}W {r.losses}L{r.draws ? ` ${r.draws}D` : ""}
                </span>
              </span>
              <WinRing rate={winRate(r)} />
            </>
          );
          return (
            <li key={r.key}>
              {onPick ? (
                <button
                  type="button"
                  aria-pressed={picked === r.key}
                  onClick={() => onPick(r.key)}
                  className={`${row} transition hover:bg-panel2 ${picked === r.key ? "bg-accentbg" : ""}`}
                >
                  {body}
                </button>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="h-11 w-full border-t border-line text-xs font-semibold text-brand-gold hover:underline">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

const dayLabel = (iso: string) => {
  const day = new Date(iso).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 86_400_000).toDateString()) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
};

export default function MatchesPage() {
  const { cards, loading } = useAppData();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deckId, setDeckId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [period, setPeriod] = useState("");
  const [format, setFormat] = useState("");
  const [visible, setVisible] = useState(STEP);
  const [tab, setTab] = useState<Tab>("legends");

  const load = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([fetch("/api/matches"), fetch("/api/decks")]);
      const [mj, dj] = await Promise.all([m.json().catch(() => null), d.json().catch(() => null)]);
      if (d.ok && Array.isArray(dj)) setDecks(dj);
      if (!m.ok) throw new Error(mj?.error ?? "Couldn't load your matches.");
      setMatches(mj);
      setError(null);
    } catch (e) {
      setMatches((cur) => cur ?? []);
      setError(e instanceof Error ? e.message : "Couldn't load your matches.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const index = useMemo(() => buildDeckIndex(cards), [cards]);
  const legendCard = useMemo(() => {
    const memo = new Map<string, RiftCard | undefined>();
    return (name: string) => {
      if (!memo.has(name)) memo.set(name, cardById.get(parseDeck(`Legend:\n1 ${name}`, index).entries[0]?.cardId ?? ""));
      return memo.get(name);
    };
  }, [cardById, index]);

  const families = useMemo(() => deckFamilies(decks), [decks]);
  const labels = useMemo(() => deckLabels(decks), [decks]);
  const familyOf = useMemo(() => new Map(decks.map((d) => [d.id, d.familyId])), [decks]);

  // Period and format narrow everything; the opponent filter leaves the matchup
  // table whole, the deck filter the deck one.
  const inPeriod = useMemo(() => {
    const since = period ? Date.now() - Number(period) * 86_400_000 : 0;
    return (matches ?? []).filter((m) => new Date(m.playedAt).getTime() >= since && (!format || m.summary.format === format));
  }, [matches, period, format]);
  const inScope = useMemo(
    () =>
      inPeriod.filter((m) => {
        if (!deckId) return true;
        if (deckId === NO_DECK) return !m.deckId;
        if (deckId.startsWith(FAMILY)) return !!m.deckId && FAMILY + familyOf.get(m.deckId) === deckId;
        return m.deckId === deckId;
      }),
    [inPeriod, deckId, familyOf]
  );
  const shown = useMemo(() => inScope.filter((m) => !opponent || m.summary.opp.legend === opponent), [inScope, opponent]);

  const rows = useMemo(() => groupSeries(shown), [shown]);
  const seriesTotal = useMemo(() => {
    const done = rows.filter(isSeries).filter((r) => r.result);
    const wins = done.filter((r) => r.result === "win").length;
    return { games: done.length, wins, losses: done.length - wins, draws: 0 };
  }, [rows]);

  // A row per deck; one with versions has a row for each under it.
  const deckRows = useMemo(() => {
    const games = inPeriod.filter((m) => !opponent || m.summary.opp.legend === opponent);
    const several = new Map(families.filter(hasVersions).map((f) => [f.id, f]));
    const key = (m: Match) => {
      if (!m.deckId) return NO_DECK;
      const family = familyOf.get(m.deckId);
      return family && several.has(family) ? FAMILY + family : m.deckId;
    };
    const label = (k: string) => (k === NO_DECK ? "No saved deck" : (several.get(k.slice(FAMILY.length))?.name ?? labels.get(k) ?? "Deleted deck"));
    const versions = new Map<string, Row[]>();
    for (const f of several.values()) {
      const order = f.versions.map((d) => d.id);
      const mine = groupBy(games.filter((m) => m.deckId && order.includes(m.deckId)), (m) => m.deckId, (id) => `v${f.versions[order.indexOf(id)].version}`);
      versions.set(FAMILY + f.id, mine.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)));
    }
    return { rows: groupBy(games, key, label), versions };
  }, [families, familyOf, labels, inPeriod, opponent]);
  // "All versions" only where there's more than one.
  const deckFilter = useMemo(
    () =>
      families.flatMap((f) => [
        ...(hasVersions(f) ? [{ value: FAMILY + f.id, label: `${f.name} (all versions)` }] : []),
        ...f.versions.map((d) => ({ value: d.id, label: labels.get(d.id) ?? d.name })),
      ]),
    [families, labels]
  );
  const stats = useMemo(
    () => ({
      total: tally(shown),
      first: tally(shown.filter((m) => m.summary.wentFirst === true)),
      second: tally(shown.filter((m) => m.summary.wentFirst === false)),
      turns: average(shown.map((m) => m.summary.turns || null)),
      ms: average(shown.map((m) => m.summary.durationMs)),
      matchups: groupBy(inScope, (m) => m.summary.opp.legend),
      battlefields: groupBy(shown, (m) => m.summary.me.battlefield),
      cards: cardRows(shown),
    }),
    [shown, inScope]
  );

  // The sideboard guide: the filtered deck's, or the newest version of the last one played.
  const guideDeck = useMemo(() => {
    if (deckId === NO_DECK) return undefined;
    const exact = decks.find((d) => d.id === deckId);
    if (exact) return exact;
    const last = matches?.find((m) => m.deckId && familyOf.has(m.deckId))?.deckId;
    const family = deckId.startsWith(FAMILY) ? deckId.slice(FAMILY.length) : last ? familyOf.get(last) : undefined;
    return (families.find((f) => f.id === family) ?? families[0])?.latest;
  }, [deckId, decks, families, familyOf, matches]);

  const opponents = useMemo(() => [...new Set((matches ?? []).map((m) => m.summary.opp.legend))].sort(), [matches]);

  async function patch(m: Match, change: { deckId?: string | null; notes?: string; result?: MatchResult }) {
    const { result, ...rest } = change;
    setMatches((cur) =>
      (cur ?? []).map((x) =>
        x.id !== m.id
          ? x
          : {
              ...x,
              ...rest,
              ...(result ? { result, summary: { ...x.summary, result, inferred: false } } : {}),
            }
      )
    );
    const res = await fetch(`/api/matches/${m.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    }).catch(() => null);
    if (!res?.ok) {
      await load(); // back to what's saved
      setError("Couldn't save that change.");
    }
  }

  async function savePlan(deck: Deck, legend: string, plan: SidePlan) {
    setDecks((cur) => cur.map((d) => (d.id === deck.id ? { ...d, guide: { ...d.guide, [legend]: plan } } : d)));
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legend, plan }),
      keepalive: true, // also when leaving the page
    }).catch(() => null);
    if (!res?.ok) setError("Couldn't save the sideboard plan.");
  }

  async function remove(m: Match) {
    if (!confirm(`Delete this game against ${m.summary.opp.legend}? You can import the replay again later.`)) return;
    const res = await fetch(`/api/matches/${m.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setMatches((cur) => (cur ?? []).filter((x) => x.id !== m.id));
    else setError("Couldn't delete the game.");
  }

  async function saveDeck(side: MatchSide): Promise<boolean> {
    const { entries } = parseDeck(side.deckText, index);
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `${side.legend} - ${side.name}`.slice(0, 80), entries }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't save the deck.");
      return false;
    }
    const deck: Deck = await res.json();
    setDecks((cur) => [deck, ...cur]);
    return true;
  }

  if (loading || matches === null) return <ListSkeleton label="Loading matches" />;

  const actions: MatchActions = {
    decks,
    deckLabel: (id) => labels.get(id),
    legendCard,
    onDeck: (m, id) => patch(m, { deckId: id }),
    onNotes: (m, notes) => patch(m, { notes }),
    onResult: (m, result) => patch(m, { result }),
    onDelete: remove,
    onSaveDeck: saveDeck,
  };

  // matches under the day they were played
  const days: { label: string; rows: typeof rows }[] = [];
  for (const r of rows.slice(0, visible)) {
    const label = dayLabel((isSeries(r) ? r.games[0] : r).playedAt);
    if (days.at(-1)?.label === label) days.at(-1)!.rows.push(r);
    else days.push({ label, rows: [r] });
  }

  const toggle = (set: React.Dispatch<React.SetStateAction<string>>) => (key: string) => set((cur) => (cur === key ? "" : key));

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        kicker="Games"
        title="Match history"
        meta="YOUR RIFTATLAS GAMES AND HOW EACH DECK IS DOING"
        right={
          <button type="button" onClick={() => setImporting(true)} className="btn-3d h-11 rounded-lg px-5 font-display text-xs font-semibold uppercase tracking-wide">
            Import replays
          </button>
        }
      />

      {error && (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          ✕ {error}
        </p>
      )}

      {matches.length === 0 ? (
        !error && (
          <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-t3">
            No games yet. On RiftAtlas, download the replay of a finished game and import the file here.
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <div className="min-w-0 sm:w-56">
              <Select
                value={deckId}
                onChange={setDeckId}
                ariaLabel="Filter by deck"
                className="h-11 text-sm"
                options={[{ value: "", label: "All decks" }, ...deckFilter, { value: NO_DECK, label: "No saved deck" }]}
              />
            </div>
            <div className="min-w-0 sm:w-56">
              <Select
                value={opponent}
                onChange={setOpponent}
                ariaLabel="Filter by opponent legend"
                className="h-11 text-sm"
                options={[{ value: "", label: "All opponents" }, ...opponents.map((o) => ({ value: o, label: o }))]}
              />
            </div>
            <div className="min-w-0 sm:w-40">
              <Select value={period} onChange={setPeriod} searchable={false} ariaLabel="Period" className="h-11 text-sm" menuMinWidth={160} options={PERIODS} />
            </div>
            <div className="min-w-0 sm:w-40">
              <Select value={format} onChange={setFormat} searchable={false} ariaLabel="Format" className="h-11 text-sm" menuMinWidth={160} options={FORMATS} />
            </div>
            {(deckId || opponent || period || format) && (
              <button
                type="button"
                onClick={() => {
                  setDeckId("");
                  setOpponent("");
                  setPeriod("");
                  setFormat("");
                }}
                className="h-11 px-2 text-sm font-semibold text-brand-gold hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* summary */}
          {/* A column per side, so neither stretches the other. On a phone: summary, guide, win rates, games. */}
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
              <section aria-label="Summary" className="order-1 flex min-w-0 flex-col gap-6 py-2 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex items-center gap-6">
                  <WinRing rate={winRate(stats.total)} size="lg" />
                  <div>
                    <p className="label">Win rate</p>
                    <p className="num mt-2 whitespace-nowrap font-display text-2xl font-bold leading-none">
                      <span className="text-ok">{stats.total.wins}W</span> <span className="text-bad">{stats.total.losses}L</span>
                      {stats.total.draws > 0 && <span className="text-t2"> {stats.total.draws}D</span>}
                    </p>
                    <p className="num mt-2 text-xs text-t3">
                      {stats.total.games} {stats.total.games === 1 ? "game" : "games"}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-5 border-line sm:border-l sm:pl-8">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-4">
                    <Fact label="Bo3 series" value={pct(winRate(seriesTotal))} sub={record(seriesTotal)} />
                    <Fact label="Going first" value={pct(winRate(stats.first))} sub={record(stats.first)} />
                    <Fact label="Going second" value={pct(winRate(stats.second))} sub={record(stats.second)} />
                    <Fact label="Average game" value={stats.turns === null ? "–" : `${stats.turns.toFixed(1)} turns`} sub={stats.ms === null ? undefined : `${Math.max(1, Math.round(stats.ms / 60000))} min`} />
                  </dl>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="label">Latest</span>
                    <span className="flex flex-wrap gap-1">
                      {shown.slice(0, LAST).map((m) => (
                        <ResultDot key={m.id} result={m.result} title={`${m.summary.opp.legend} ${m.summary.me.score}–${m.summary.opp.score}`} />
                      ))}
                    </span>
                  </div>
                </div>
              </section>

              {/* games */}
              <section aria-label="Games" className="order-4 flex min-w-0 flex-col gap-5">
                {shown.length === 0 && <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-t3">No games with these filters.</p>}
                {days.map((d) => (
                  <div key={d.label}>
                    <h2 className="label mb-2">{d.label}</h2>
                    <ul className="flex flex-col gap-2">
                      {d.rows.map((r) =>
                        isSeries(r) ? <MatchRow key={r.id} games={r.games} series={r} actions={actions} /> : <MatchRow key={r.id} games={[r]} actions={actions} />
                      )}
                    </ul>
                  </div>
                ))}
                {rows.length > visible && (
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + STEP)}
                    className="h-11 w-full rounded-xl border border-line bg-panel text-sm font-semibold text-t2 transition hover:border-line2 hover:text-t1"
                  >
                    Show more ({rows.length - visible} left)
                  </button>
                )}
              </section>
            </div>

            <div className="contents lg:flex lg:flex-col lg:gap-5 lg:self-stretch">
              <div className="order-2">
                <SideboardGuide
                  key={guideDeck?.id ?? ""}
                  deck={guideDeck}
                  label={guideDeck ? (labels.get(guideDeck.id) ?? guideDeck.name) : ""}
                  matches={matches}
                  familyOf={familyOf}
                  cards={cards}
                  cardById={cardById}
                  index={index}
                  legendCard={legendCard}
                  onSave={savePlan}
                />
              </div>

              {/* win rates */}
              <section aria-label="Win rates" className="order-3 overflow-hidden rounded-xl border border-line bg-panel lg:sticky lg:top-[5.5rem]">
                <div className="border-b border-line p-3">
                  <SlideGroup role="tablist" aria-label="Win rate by" className="flex gap-1 rounded-lg border border-line bg-ink p-1">
                    {TABS.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === x.id}
                        data-active={tab === x.id}
                        onClick={() => setTab(x.id)}
                        className={`h-9 flex-1 rounded-md text-xs font-semibold transition ${tab === x.id ? "text-on-accent" : "text-t2 hover:text-t1"}`}
                      >
                        {x.label}
                      </button>
                    ))}
                  </SlideGroup>
                  <p className="mt-2.5 px-1 text-xs leading-snug text-t3">{HINT[tab]}</p>
                </div>
                {tab === "legends" && <Rates rows={stats.matchups} art={legendCard} onPick={toggle(setOpponent)} picked={opponent} />}
                {tab === "decks" && <Rates rows={deckRows.rows} nested={deckRows.versions} onPick={toggle(setDeckId)} picked={deckId} />}
                {tab === "battlefields" && <Rates rows={stats.battlefields} />}
                {tab === "cards" && <Rates rows={stats.cards} />}
              </section>
            </div>
          </div>
        </>
      )}

      {importing && (
        <MatchImportModal
          decks={decks}
          matches={matches}
          index={index}
          cardById={cardById}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            load();
          }}
        />
      )}
    </div>
  );
}
