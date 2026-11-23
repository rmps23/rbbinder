// Reads a RiftAtlas replay (the JSON its "download replay" gives you) and keeps
// what the match history needs: who won and why, both decklists, the score turn
// by turn and the cards each side played. Runs in the browser - a replay is
// several hundred KB, the summary a few, and only the summary is sent and saved.
//
// Format: `nodes` is a table of shared values, each ["a", items] (a list) or
// ["o", [key, value] pairs] (an object); a value of {"r": n} points at node n.
// `root` is the replay: players plus one full game state per action (`frames`).

import type { MatchSide, MatchSummary } from "./types";

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function decode(file: Json): Json {
  const nodes = list(file.nodes);
  const memo = new Map<number, unknown>();
  const value = (v: unknown): unknown => {
    const ref = num(obj(v).r);
    return ref !== null ? node(ref) : v;
  };
  function node(i: number): unknown {
    if (memo.has(i)) return memo.get(i);
    const [kind, payload] = list(nodes[i]);
    if (kind === "a") {
      const out: unknown[] = [];
      memo.set(i, out); // before filling it, so a cycle can't recurse forever
      for (const v of list(payload)) out.push(value(v));
      return out;
    }
    const out: Json = Object.create(null);
    memo.set(i, out);
    for (const pair of list(payload)) {
      const [key, v] = list(pair);
      if (typeof key === "string") out[key] = value(v);
    }
    return out;
  }
  return obj(value(file.root));
}

const playersOf = (state: Json): Json[] => list(state.players).map(obj);

// "1 Shen, Eye of Twilight [VEN-147]" under "Legend:" -> "Shen, Eye of Twilight"
function firstUnder(deckText: string, heading: string): string {
  const lines = deckText.split(/\r?\n/).map((l) => l.trim());
  const at = lines.findIndex((l) => l.replace(/:$/, "").toLowerCase() === heading.toLowerCase());
  const line = at < 0 ? "" : (lines.slice(at + 1).find(Boolean) ?? "");
  if (!/^\d/.test(line)) return "";
  return line
    .replace(/^\d+\s*x?\s+/i, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .trim();
}

export class ReplayError extends Error {}

// `as` = read the game from this player's side (default: whoever saved the replay).
export function parseReplay(text: string, as?: string): MatchSummary {
  let file: Json;
  try {
    file = obj(JSON.parse(text));
  } catch {
    throw new ReplayError("This isn't a JSON file.");
  }
  if (file.format !== "riftatlas-replay") throw new ReplayError("This isn't a RiftAtlas replay.");
  if (file.version !== 2) throw new ReplayError(`Replay version ${String(file.version)} isn't supported yet (only 2).`);

  const replay = decode(file);
  const frames = list(replay.frames).map(obj);
  const last = obj(frames[frames.length - 1]?.state);
  const players = playersOf(last);
  if (players.length !== 2) throw new ReplayError("Only 1v1 games can be imported.");

  const outcome = obj(last.gameOutcome);
  // No outcome is written when the players just move on to the next game of a series.
  const inferred = !Array.isArray(outcome.winnerPlayerIds);
  if (inferred && num(last.turnNumber) === null) throw new ReplayError("This game never started.");

  const meId = as ?? str(replay.viewerPlayerId);
  const me = players.find((p) => p.id === meId) ?? players.find((p) => p.seat === 0) ?? players[0];
  const opp = players.find((p) => p !== me)!;
  const points = (p: Json) => num(obj(p.board).score) ?? 0;
  const winners = inferred
    ? [me, opp].filter((p) => points(p) >= Math.max(points(me), points(opp))).map((p) => p.id)
    : list(outcome.winnerPlayerIds);
  const result = winners.includes(me.id) === winners.includes(opp.id) ? "draw" : winners.includes(me.id) ? "win" : "loss";

  // Each state only carries the latest log lines: collect them all.
  const log = new Map<string, Json>();
  for (const f of frames) for (const entry of list(obj(f.state).log).map(obj)) log.set(str(entry.id), entry);
  const entries = [...log.values()].sort((a, b) => (num(a.at) ?? 0) - (num(b.at) ?? 0));

  // Score at the end of every turn (the last state seen of that turn, so a
  // rewound action doesn't count).
  const score = (state: Json, id: unknown) => num(obj(playersOf(state).find((p) => p.id === id)?.board).score) ?? 0;
  const byTurn = new Map<number, { turn: number; me: number; opp: number }>();
  for (const f of frames) {
    const state = obj(f.state);
    const turn = num(state.turnNumber);
    if (turn !== null && turn > 0) byTurn.set(turn, { turn, me: score(state, me.id), opp: score(state, opp.id) });
  }

  const side = (p: Json): MatchSide => {
    const name = str(p.name);
    const deckText = str(obj(p.submittedDeck).raw) || str(obj(p.registeredDeck).raw) || str(p.decklistRaw);
    const played = new Set<string>();
    let mulligan: number | null = null;
    for (const e of entries) {
      if (e.authorPlayerId !== p.id) continue;
      const line = str(e.text);
      // "Rezso played Kayle, Justified from hand to base." / "Played Discipline from hand."
      const card = line.match(/^(?:.* )?[Pp]layed (.+) from hand(?: to .+)?\.$/)?.[1];
      if (card) played.add(card);
      const m = line.match(/finalized mulligan \((\d+) recycled/);
      if (m) mulligan = Number(m[1]);
    }
    return {
      name,
      legend: firstUnder(deckText, "Legend"),
      champion: firstUnder(deckText, "Champion"),
      battlefield: str(p.selectedBattlefield),
      deckText,
      score: score(last, p.id),
      mulligan,
      played: [...played],
    };
  };

  const startedAt = num(last.gameHistoryStartedAt) ?? num(replay.createdAt) ?? Date.now();
  const endedAt = num(last.gameHistoryEndedAt) ?? num(replay.completedAt);
  const replayId = str(replay.replayId);
  if (!replayId) throw new ReplayError("This replay has no id.");
  // "KUS3M:1795455509041:1:…" = room : when the series started : game number : start
  const [room, opened, game] = replayId.split(":");
  const summary: MatchSummary = {
    replayId,
    // Not the room: each game of a series can be played in a new one. The series keeps its start.
    seriesId: String(num(last.seriesStartedAt) ?? opened ?? room),
    gameNumber: num(last.gameNumber) ?? (Number(game) || 1),
    format: str(last.matchFormat) || "bo1",
    playedAt: new Date(startedAt).toISOString(),
    durationMs: endedAt ? Math.max(0, endedAt - startedAt) : null,
    result,
    ...(inferred ? { inferred } : {}),
    reason: str(outcome.reason) || "unknown",
    turns: num(outcome.decidedAtTurnNumber) ?? num(last.turnNumber) ?? 0,
    wentFirst: last.firstPlayerId ? last.firstPlayerId === me.id : null,
    scores: [...byTurn.values()].sort((a, b) => a.turn - b.turn),
    me: side(me),
    opp: side(opp),
    players: [
      { id: str(me.id), name: str(me.name) },
      { id: str(opp.id), name: str(opp.name) },
    ],
  };
  if (!summary.me.legend || !summary.opp.legend) throw new ReplayError("Couldn't find both legends in this replay.");
  return summary;
}
