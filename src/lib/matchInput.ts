// The browser reads the replay, so the server checks the summary it sends:
// right shape, bounded sizes, nothing extra stored.

import type { MatchSide, MatchSummary, SideCard } from "./types";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : null);

function cleanSide(v: unknown): MatchSide | null {
  const s = obj(v);
  if (!s) return null;
  const legend = text(s.legend, 120);
  if (!legend) return null;
  return {
    name: text(s.name, 80),
    legend,
    champion: text(s.champion, 120),
    battlefield: text(s.battlefield, 120),
    deckText: text(s.deckText, 6000),
    score: int(s.score, 99) ?? 0,
    mulligan: int(s.mulligan, 20),
    played: (Array.isArray(s.played) ? s.played : []).slice(0, 120).map((c) => text(c, 120)).filter(Boolean),
  };
}

// null = not a list. A card counts once; 0 copies is the same as not being there.
export function cleanSideIn(v: unknown): SideCard[] | null {
  if (!Array.isArray(v)) return null;
  const out = new Map<string, SideCard>();
  for (const c of v.slice(0, 20)) {
    const name = text(obj(c)?.name, 120);
    const qty = int(obj(c)?.qty, 3);
    if (name && qty) out.set(name, { name, qty });
  }
  return [...out.values()];
}

export function cleanSummary(v: unknown): MatchSummary | null {
  const s = obj(v);
  if (!s) return null;
  const me = cleanSide(s.me);
  const opp = cleanSide(s.opp);
  const replayId = text(s.replayId, 120);
  const played = new Date(text(s.playedAt, 40));
  if (!me || !opp || !replayId || Number.isNaN(played.getTime())) return null;
  if (s.result !== "win" && s.result !== "loss" && s.result !== "draw") return null;
  return {
    replayId,
    seriesId: text(s.seriesId, 120),
    gameNumber: int(s.gameNumber, 99) ?? 1,
    format: text(s.format, 20),
    playedAt: played.toISOString(),
    durationMs: int(s.durationMs, 24 * 60 * 60 * 1000),
    result: s.result,
    ...(s.inferred === true ? { inferred: true } : {}),
    reason: text(s.reason, 40),
    turns: int(s.turns, 999) ?? 0,
    wentFirst: typeof s.wentFirst === "boolean" ? s.wentFirst : null,
    scores: (Array.isArray(s.scores) ? s.scores : []).slice(0, 200).map((p) => {
      const o = obj(p) ?? {};
      return { turn: int(o.turn, 999) ?? 0, me: int(o.me, 99) ?? 0, opp: int(o.opp, 99) ?? 0 };
    }),
    me,
    opp,
    players: (Array.isArray(s.players) ? s.players : []).slice(0, 2).map((p) => {
      const o = obj(p) ?? {};
      return { id: text(o.id, 60), name: text(o.name, 80) };
    }),
  };
}
