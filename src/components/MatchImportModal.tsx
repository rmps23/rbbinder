"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { ResultPicker, ResultTag } from "./MatchRow";
import { closestDeck, needsCheck } from "@/lib/matchStats";
import { parseReplay } from "@/lib/riftAtlas";
import { deckOptions } from "@/lib/deckVersions";
import type { buildDeckIndex } from "@/lib/deck";
import type { Deck, Match, MatchSummary, RiftCard } from "@/lib/types";

type Item = { text: string; summary: MatchSummary; deckId: string; known: boolean };
const MAX_FILE = 20 * 1024 * 1024;
const BATCH = 50; // the most games the API takes at once
const bestOf = (s: MatchSummary) => Number(s.format.match(/^bo(\d+)$/i)?.[1] ?? 1);

export function MatchImportModal({
  decks,
  matches,
  index,
  cardById,
  onClose,
  onImported,
}: {
  decks: Deck[];
  matches: Match[];
  index: ReturnType<typeof buildDeckIndex>;
  cardById: Map<string, RiftCard>;
  onClose: () => void;
  onImported: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const known = useMemo(() => new Set(matches.map((m) => m.summary.replayId)), [matches]);

  const guess = (s: MatchSummary) => closestDeck(s.me.deckText, decks, index, cardById)?.deck.id ?? "";

  async function add(files: File[]) {
    const found: Item[] = [];
    const failed: string[] = [];
    const seen = new Set(items.map((i) => i.summary.replayId));
    setBusy(true);
    for (const f of files) {
      try {
        if (f.size > MAX_FILE) throw new Error("File is too big.");
        const text = await f.text();
        const summary = parseReplay(text);
        if (seen.has(summary.replayId)) {
          const which = bestOf(summary) > 1 ? ` (game ${summary.gameNumber} against ${summary.opp.name})` : "";
          throw new Error(`it's the same game as another file here${which}. Download the JSON of the other games.`);
        }
        seen.add(summary.replayId);
        found.push({ text, summary, deckId: guess(summary), known: known.has(summary.replayId) });
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof Error ? e.message : "couldn't be read"}`);
      }
    }
    setItems((cur) => [...new Map([...found, ...cur].map((i) => [i.summary.replayId, i])).values()]);
    setErrors(failed);
    setBusy(false);
  }

  const patch = (id: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.summary.replayId === id ? { ...i, ...p } : i)));

  // A friend's replay, or one saved from a spectator seat: read it from the other side.
  function swap(item: Item) {
    const other = item.summary.players[1]?.id;
    if (!other) return;
    const { seriesId, gameNumber } = item.summary;
    const summary = { ...parseReplay(item.text, other), seriesId, gameNumber };
    patch(item.summary.replayId, { summary, deckId: guess(summary) });
  }

  const fresh = items.filter((i) => !i.known);

  // Games of one series together, in order; single games each on their own.
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) {
      const key = bestOf(i.summary) > 1 ? i.summary.seriesId : i.summary.replayId;
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    for (const g of map.values()) g.sort((a, b) => a.summary.gameNumber - b.summary.gameNumber);
    return [...map.entries()].map(([key, games]) => ({ key, games }));
  }, [items]);

  // Two games of the new series can't both be, say, game 2.
  const clash = groups.some(({ games }) => new Set(games.map((g) => g.summary.gameNumber)).size < games.length);

  const patchMany = (games: Item[], p: (i: Item) => Partial<Item>) => {
    const ids = new Set(games.map((g) => g.summary.replayId));
    setItems((cur) => cur.map((i) => (ids.has(i.summary.replayId) && !i.known ? { ...i, ...p(i) } : i)));
  };

  // A game of the series whose replay is gone: just the result and the score.
  function addByHand(first: MatchSummary, deckId: string, gameNumber: number) {
    const side = (p: MatchSummary["me"]) => ({ ...p, score: 0, mulligan: null, battlefield: "", played: [] });
    const summary: MatchSummary = {
      ...first,
      replayId: `manual:${first.seriesId}:${gameNumber}`,
      gameNumber,
      result: "loss",
      inferred: false,
      reason: "manual",
      turns: 0,
      durationMs: null,
      wentFirst: null,
      scores: [],
      me: side(first.me),
      opp: side(first.opp),
      // keeps the games in order in the history
      playedAt: new Date(new Date(first.playedAt).getTime() + (gameNumber - first.gameNumber) * 60_000).toISOString(),
    };
    setItems((cur) => (cur.some((i) => i.summary.replayId === summary.replayId) ? cur : [...cur, { text: "", summary, deckId, known: known.has(summary.replayId) }]));
  }

  // Another series against the same person in this import: maybe the same one.
  function joinable(games: Item[]) {
    const first = games[0].summary;
    if (bestOf(first) <= 1) return [];
    return groups
      .filter((g) => g.games !== games && g.games.every((i) => !i.known) && bestOf(g.games[0].summary) === bestOf(first))
      .filter((g) => g.games[0].summary.opp.name === first.opp.name && g.games.length + games.length <= bestOf(first))
      .flatMap((g) => g.games);
  }
  function join(games: Item[], others: Item[]) {
    const all = [...games, ...others].sort((a, b) => a.summary.playedAt.localeCompare(b.summary.playedAt));
    patchMany(others, (i) => ({ summary: { ...i.summary, seriesId: games[0].summary.seriesId } }));
    // numbered the same in different files? then by the time they were played
    if (new Set(all.map((i) => i.summary.gameNumber)).size < all.length) {
      patchMany(all, (i) => ({
        summary: { ...i.summary, seriesId: games[0].summary.seriesId, gameNumber: all.findIndex((x) => x.summary.replayId === i.summary.replayId) + 1 },
      }));
    }
  }

  async function save() {
    setBusy(true);
    setErrors([]);
    try {
      for (let i = 0; i < fresh.length; i += BATCH) {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: fresh.slice(i, i + BATCH).map((x) => ({ summary: x.summary, deckId: x.deckId || null })) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't save the games");
      }
      onImported();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Couldn't save the games"]);
      setBusy(false);
    }
  }

  const gameCard = (i: Item, single: boolean) => (
    <li key={i.summary.replayId} className={`rounded-xl border border-line bg-panel2 p-3 ${i.known ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        {!single && !i.known && (
          <div className="w-28 shrink-0">
            <Select
              value={String(i.summary.gameNumber)}
              onChange={(n) => patch(i.summary.replayId, { summary: { ...i.summary, gameNumber: Number(n) } })}
              searchable={false}
              ariaLabel="Which game of the series"
              className="h-9 text-sm"
              menuMinWidth={112}
              options={Array.from({ length: bestOf(i.summary) }, (_, n) => ({ value: String(n + 1), label: `Game ${n + 1}` }))}
            />
          </div>
        )}
        <ResultTag result={i.summary.result} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-t1">
            {single ? (
              <>
                {i.summary.me.legend} <span className="font-normal text-t3">vs</span> {i.summary.opp.legend}
              </>
            ) : (
              `${i.known ? `Game ${i.summary.gameNumber}: ` : ""}${i.summary.me.name} ${i.summary.me.score}–${i.summary.opp.score} ${i.summary.opp.name}`
            )}
          </p>
          <p className="num truncate text-xs text-t3">
            {single && `${i.summary.me.name} ${i.summary.me.score}–${i.summary.opp.score} ${i.summary.opp.name} · `}
            {new Date(i.summary.playedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <button
          type="button"
          aria-label="Leave this game out"
          onClick={() => setItems((cur) => cur.filter((x) => x.summary.replayId !== i.summary.replayId))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-t3 hover:bg-cavity hover:text-t1"
        >
          ✕
        </button>
      </div>
      {i.known ? (
        <p className="mt-2 text-xs text-t3">Already in your history.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(needsCheck(i.summary) || i.summary.inferred === false) && (
            <div className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${i.summary.inferred ? "bg-warn/10 text-warn" : "bg-ink text-t3"}`}>
              {i.summary.inferred ? "⚠ The replay names no winner. This is from the score - is it right?" : "Result set by you."}
              <ResultPicker value={i.summary.result} onChange={(result) => patch(i.summary.replayId, { summary: { ...i.summary, result, inferred: false } })} />
            </div>
          )}
          {!i.text && (
            <span className="num flex items-center gap-2 text-xs text-t2">
              {(["me", "opp"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  {i.summary[k].name}
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={i.summary[k].score}
                    onChange={(e) => patch(i.summary.replayId, { summary: { ...i.summary, [k]: { ...i.summary[k], score: Math.max(0, Math.min(99, Number(e.target.value) || 0)) } } })}
                    className="h-9 w-16 rounded-lg border border-line bg-ink px-2 text-center text-sm text-t1"
                  />
                </label>
              ))}
            </span>
          )}
          {single && (
            <div className="min-w-[180px] flex-1">
              <Select
                value={i.deckId}
                onChange={(deckId) => patch(i.summary.replayId, { deckId })}
                ariaLabel="Deck you played"
                className="h-9 text-sm"
                options={[{ value: "", label: "No saved deck" }, ...deckOptions(decks)]}
              />
            </div>
          )}
          {i.text && (
            <button type="button" onClick={() => swap(i)} className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-t2 transition hover:border-line2 hover:text-t1">
              I was {i.summary.opp.name}
            </button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <Modal
      title="Import matches"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={busy || !fresh.length || clash} className="btn-3d h-11 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide disabled:opacity-50">
            {busy ? "One moment…" : fresh.length ? `Save ${fresh.length} ${fresh.length === 1 ? "game" : "games"}` : "Save"}
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-5 text-sm font-semibold text-t2 transition hover:border-line2 hover:text-t1">
            Cancel
          </button>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add([...e.dataTransfer.files]);
        }}
        className={`rounded-xl border border-dashed px-4 py-8 text-center transition ${over ? "border-brand-gold bg-accentbg" : "border-line2 hover:border-brand-gold"}`}
      >
        <span className="block text-sm font-semibold text-t1">Drop RiftAtlas replays here, or click to choose</span>
        <span className="mt-1 block text-xs text-t3">riftatlas-replay-….json, as many as you like - all the games of a Bo3 at once. Games you already saved are skipped.</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        multiple
        aria-label="RiftAtlas replay files"
        className="hidden"
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {errors.map((e) => (
        <p key={e} role="alert" className="break-words rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          ✕ {e}
        </p>
      ))}

      <ul className="flex flex-col gap-2">
        {groups.map(({ key, games }) => {
          const first = games[0].summary;
          const best = bestOf(first);
          if (best <= 1) return gameCard(games[0], true);

          // Games of this series saved earlier count for the score too.
          const ids = new Set(games.map((g) => g.summary.replayId));
          const saved = matches.filter((m) => m.summary.seriesId === first.seriesId && !ids.has(m.summary.replayId)).map((m) => m.summary);
          const all = [...games.map((g) => g.summary), ...saved];
          const wins = all.filter((x) => x.result === "win").length;
          const losses = all.filter((x) => x.result === "loss").length;
          const need = Math.ceil(best / 2);
          const have = new Set(all.map((x) => x.gameNumber));
          const last = wins >= need || losses >= need ? Math.max(...have) : Math.max(need, ...have);
          const missing = Array.from({ length: last }, (_, n) => n + 1).filter((n) => !have.has(n));
          const decided = wins >= need || losses >= need;
          const open = Array.from({ length: decided ? last : best }, (_, n) => n + 1).filter((n) => !have.has(n));
          const twice = have.size < all.length;
          const others = joinable(games);
          const deckIds = new Set(games.map((g) => g.deckId));
          return (
            <li key={key} className="rounded-xl border border-line2 p-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-2 pt-1">
                {wins >= need || losses >= need ? (
                  <ResultTag result={wins >= need ? "win" : "loss"} />
                ) : (
                  <span className="shrink-0 rounded-md bg-cavity px-2 py-1 text-xs font-bold text-t2">Incomplete</span>
                )}
                <p className="min-w-0 flex-1 truncate text-sm text-t2">
                  <b className="text-t1">{first.format.toUpperCase()}</b> vs {first.opp.legend} · {first.opp.name}
                </p>
                <span className="num font-display text-xl font-bold text-t1" aria-label={`Games ${wins} to ${losses}`}>
                  {wins}–{losses}
                </span>
                {games.some((g) => !g.known) && (
                  <div className="w-full">
                    <Select
                      value={deckIds.size === 1 ? games[0].deckId : ""}
                      onChange={(deckId) => patchMany(games, () => ({ deckId }))}
                      ariaLabel="Deck you played in this series"
                      className="h-9 text-sm"
                      options={[{ value: "", label: deckIds.size === 1 ? "No saved deck" : "Different decks" }, ...deckOptions(decks)]}
                    />
                  </div>
                )}
                {open.length > 0 && (
                  <div className="flex w-full flex-wrap items-center gap-2 text-xs text-t3">
                    <span>
                      {missing.length > 0 ? `Missing game ${missing.join(" and ")}. ` : ""}Drop its replay here, or, without one:
                    </span>
                    {open.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => addByHand(first, games[0].deckId, n)}
                        className="h-9 rounded-lg border border-line px-3 font-semibold text-t2 transition hover:border-line2 hover:text-t1"
                      >
                        + Game {n} by hand
                      </button>
                    ))}
                  </div>
                )}
                {twice && <p className="w-full text-xs text-bad">✕ Two games have the same number. Change one below.</p>}
                {others.length > 0 && (
                  <button
                    type="button"
                    onClick={() => join(games, others)}
                    className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-t2 transition hover:border-line2 hover:text-t1"
                  >
                    Same series as the other games against {first.opp.name}
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-2">{games.map((g) => gameCard(g, false))}</ul>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
