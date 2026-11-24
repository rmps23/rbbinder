// Numbers for the match history page, worked out from the saved matches.

import { buildDeckIndex, cardKey, parseDeck } from "./deck";
import type { Deck, DeckEntry, DeckZone, Match, MatchResult, MatchSummary, RiftCard } from "./types";

export type Tally = { games: number; wins: number; losses: number; draws: number };
export type Row = Tally & { key: string; label: string };

const empty = (): Tally => ({ games: 0, wins: 0, losses: 0, draws: 0 });

function count(t: Tally, m: Match) {
  t.games++;
  if (m.result === "win") t.wins++;
  else if (m.result === "loss") t.losses++;
  else t.draws++;
}

export function tally(matches: Match[]): Tally {
  const t = empty();
  for (const m of matches) count(t, m);
  return t;
}

// Draws don't count either way. null = no decided game yet.
export function winRate(t: Tally): number | null {
  const decided = t.wins + t.losses;
  return decided ? t.wins / decided : null;
}

export const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
export const record = (t: Tally) => `${t.wins}–${t.losses}${t.draws ? `–${t.draws}` : ""}`;

// One row per value of `key` (matches without one are left out), most played first.
export function groupBy(matches: Match[], key: (m: Match) => string | null, label: (k: string) => string = (k) => k): Row[] {
  const rows = new Map<string, Row>();
  for (const m of matches) {
    const k = key(m);
    if (!k) continue;
    let row = rows.get(k);
    if (!row) rows.set(k, (row = { key: k, label: label(k), ...empty() }));
    count(row, m);
  }
  return [...rows.values()].sort((a, b) => b.games - a.games || a.label.localeCompare(b.label));
}

// Cards you played: your record in the games where each was played at least once.
export function cardRows(matches: Match[]): Row[] {
  const rows = new Map<string, Row>();
  for (const m of matches) {
    for (const name of m.summary.me.played) {
      let row = rows.get(name);
      if (!row) rows.set(name, (row = { key: name, label: name, ...empty() }));
      count(row, m);
    }
  }
  return [...rows.values()].sort((a, b) => b.games - a.games || (winRate(b) ?? 0) - (winRate(a) ?? 0) || a.label.localeCompare(b.label));
}

export function average(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}

// Points that win a 1v1 game: whoever got there won, whatever the replay says.
const VICTORY = 8;

// The winner is a guess worth confirming: not in the replay, and nobody reached the victory score.
export const needsCheck = (s: MatchSummary) => s.inferred === true && Math.max(s.me.score, s.opp.score) < VICTORY;

// ---------- best of three ----------

export type Series = { id: string; format: string; games: Match[]; wins: number; losses: number; result: MatchResult | null };

// Best-of-N games grouped by series (games in order), single games on their own;
// keeps the newest-first order of `matches`. result is null until someone has
// won enough games - some may not have been imported.
export function groupSeries(matches: Match[]): (Match | Series)[] {
  const out: (Match | Series)[] = [];
  const open = new Map<string, Series>();
  for (const m of matches) {
    const best = Number(m.summary.format.match(/^bo(\d+)$/i)?.[1] ?? 1);
    if (best <= 1) {
      out.push(m);
      continue;
    }
    let s = open.get(m.summary.seriesId);
    if (!s) {
      s = { id: m.summary.seriesId, format: m.summary.format, games: [], wins: 0, losses: 0, result: null };
      open.set(s.id, s);
      out.push(s);
    }
    s.games.push(m);
    if (m.result === "win") s.wins++;
    else if (m.result === "loss") s.losses++;
    const need = Math.ceil(best / 2);
    s.result = s.wins >= need ? "win" : s.losses >= need ? "loss" : null;
  }
  for (const s of open.values()) s.games.sort((a, b) => a.summary.gameNumber - b.summary.gameNumber);
  return out;
}

export const isSeries = (x: Match | Series): x is Series => "games" in x;

// ---------- which of your decks was it? ----------

const MAIN: DeckZone[] = ["main", "champion"];
const WHOLE: DeckZone[] = ["main", "champion", "sideboard", "battlefield", "rune"];

function byName(entries: DeckEntry[], cardById: Map<string, RiftCard>, zones: DeckZone[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    if (!zones.includes(e.zone)) continue;
    const card = cardById.get(e.cardId);
    if (!card) continue;
    const k = cardKey(card);
    map.set(k, (map.get(k) ?? 0) + e.qty);
    total += e.qty;
  }
  return { map, total };
}

// 0..1: how much of the bigger list both have
function overlap(a: ReturnType<typeof byName>, b: ReturnType<typeof byName>) {
  let shared = 0;
  for (const [k, q] of a.map) shared += Math.min(q, b.map.get(k) ?? 0);
  return shared / Math.max(a.total, b.total, 1);
}

function legendKey(entries: DeckEntry[], cardById: Map<string, RiftCard>): string | null {
  const card = cardById.get(entries.find((e) => e.zone === "legend")?.cardId ?? "");
  return card ? cardKey(card) : null;
}

// The saved deck with the same legend that shares the most cards with the list
// that was played (0..1), if it shares at least half of the main deck. Equal
// lists: the newer deck, so the latest version.
export function closestDeck(
  deckText: string,
  decks: Deck[],
  index: ReturnType<typeof buildDeckIndex>,
  cardById: Map<string, RiftCard>
): { deck: Deck; score: number } | null {
  const played = parseDeck(deckText, index).entries;
  const legend = legendKey(played, cardById);
  const main = byName(played, cardById, MAIN);
  const whole = byName(played, cardById, WHOLE);
  let best: { deck: Deck; score: number } | null = null;
  for (const deck of decks) {
    if (!legend || legendKey(deck.entries, cardById) !== legend) continue;
    if (overlap(main, byName(deck.entries, cardById, MAIN)) < 0.5) continue;
    const score = overlap(whole, byName(deck.entries, cardById, WHOLE));
    if (!best || score > best.score || (score === best.score && deck.createdAt > best.deck.createdAt)) best = { deck, score };
  }
  return best;
}

// ---------- sideboard ----------

export type Reminder = { name: string; qty: number; games: number };

// The cards noted as "should have come in" over `matches` (newest first): the
// most noted first, with the copies of the latest note.
export function sideReminders(matches: Match[]): Reminder[] {
  const out = new Map<string, Reminder>();
  for (const m of matches) {
    for (const c of m.summary.sideIn ?? []) {
      const had = out.get(c.name);
      if (had) had.games++;
      else out.set(c.name, { ...c, games: 1 });
    }
  }
  return [...out.values()].sort((a, b) => b.games - a.games || b.qty - a.qty || a.name.localeCompare(b.name));
}
