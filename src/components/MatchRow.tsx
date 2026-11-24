"use client";

import { useEffect, useRef, useState } from "react";
import { CardImage } from "./CardImage";
import { ScoreChart } from "./ScoreChart";
import { Select } from "./Select";
import { needsCheck, type Series } from "@/lib/matchStats";
import { deckOptions } from "@/lib/deckVersions";
import type { Deck, Match, MatchResult, MatchSide, RiftCard, SideCard } from "@/lib/types";

const RESULT: Record<MatchResult, { label: string; letter: string; cls: string; bar: string }> = {
  win: { label: "Win", letter: "W", cls: "bg-ok/15 text-ok", bar: "bg-ok" },
  loss: { label: "Loss", letter: "L", cls: "bg-bad/15 text-bad", bar: "bg-bad" },
  draw: { label: "Draw", letter: "D", cls: "bg-cavity text-t2", bar: "bg-cavity" },
};

export function ResultTag({ result }: { result: MatchResult }) {
  return <span className={`block w-12 shrink-0 rounded-md py-1 text-center text-xs font-bold ${RESULT[result].cls}`}>{RESULT[result].label}</span>;
}

// One letter per game, for the latest results.
export function ResultDot({ result, title }: { result: MatchResult; title?: string }) {
  return (
    <span title={title} className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${RESULT[result].cls}`}>
      {RESULT[result].letter}
    </span>
  );
}

// Win / Loss / Draw buttons, for a result the replay doesn't say or got wrong.
export function ResultPicker({ value, onChange }: { value: MatchResult; onChange: (r: MatchResult) => void }) {
  return (
    <span role="radiogroup" aria-label="Result" className="inline-flex gap-1 rounded-lg border border-line bg-ink p-1">
      {(["win", "loss", "draw"] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${value === r ? RESULT[r].cls : "text-t3 hover:text-t1"}`}
        >
          {RESULT[r].label}
        </button>
      ))}
    </span>
  );
}

// The character on a legend card, cropped to a square.
export function LegendFace({ card, className = "h-12 w-12" }: { card: RiftCard | undefined; className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-cavity ring-1 ring-line2 ${className}`}>
      {card?.image.url && <CardImage card={card} alt="" fill sizes="96px" className="scale-125 object-cover object-[50%_22%]" />}
    </span>
  );
}

const minutes = (ms: number | null) => (ms === null ? null : `${Math.max(1, Math.round(ms / 60000))} min`);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const REASON: Record<string, string> = { score: "decided on points", concession: "ended by concession", manual: "added by hand" };

function Side({ side, face, onSaveDeck, saved }: { side: MatchSide; face?: RiftCard; onSaveDeck: () => void; saved: boolean }) {
  const facts = [
    ["Champion", side.champion],
    ["Battlefield", side.battlefield],
    ["Mulligan", side.mulligan === null ? "" : side.mulligan === 0 ? "kept all" : `${side.mulligan} ${side.mulligan === 1 ? "card" : "cards"}`],
  ].filter(([, v]) => v);
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <LegendFace card={face} className="h-10 w-10" />
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-t1">{side.name}</h4>
          <p className="truncate text-xs text-t3">{side.legend}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-t3">{k}</dt>
            <dd className="truncate text-t2">{v}</dd>
          </div>
        ))}
      </dl>
      {side.played.length > 0 && (
        <ul aria-label="Cards played" className="mt-3 flex flex-wrap gap-1.5">
          {side.played.map((c) => (
            <li key={c} className="rounded-md bg-cavity px-2 py-1 text-[11px] text-t2">
              {c}
            </li>
          ))}
        </ul>
      )}
      {side.deckText && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand-gold">Deck list</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-ink p-3 font-mono text-[11px] leading-relaxed text-t2">{side.deckText}</pre>
          <button
            type="button"
            onClick={onSaveDeck}
            disabled={saved}
            className="mt-2 h-9 rounded-lg border border-line px-3 text-xs font-semibold text-t2 transition hover:border-line2 hover:text-t1 disabled:text-ok"
          >
            {saved ? "✓ Saved to your decks" : "+ Save to my decks"}
          </button>
        </details>
      )}
    </section>
  );
}

// A card's picture, small and whole, next to its name.
export function CardThumb({ card }: { card: RiftCard | undefined }) {
  return (
    <span className="relative block h-11 w-8 shrink-0 overflow-hidden rounded bg-cavity ring-1 ring-line2">
      {card?.image.url && <CardImage card={card} alt="" fill sizes="64px" className="object-cover" />}
    </span>
  );
}

export type SideOption = SideCard & { card: RiftCard | undefined };

// What you should have sided in, picked after the game from the sideboard you had.
function SideboardPicker({ title, options, value, onChange }: { title: string; options: SideOption[]; value: SideCard[]; onChange: (cards: SideCard[]) => void }) {
  const [picked, setPicked] = useState(() => new Map(value.map((c) => [c.name, c.qty])));
  // A few clicks in a row are one save, sent even if the game is closed meanwhile.
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    pending.current?.();
    pending.current = null;
  };
  useEffect(() => flush, []);

  function set(name: string, qty: number) {
    const next = new Map(picked);
    if (qty > 0) next.set(name, qty);
    else next.delete(name);
    setPicked(next);
    pending.current = () => onChange([...next].map(([n, q]) => ({ name: n, qty: q })));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  }

  const step = "flex h-11 w-11 items-center justify-center rounded-md text-base text-t2 transition hover:bg-cavity hover:text-t1 disabled:opacity-30 sm:h-9 sm:w-9";
  return (
    <section aria-label={title} className="rounded-lg border border-line bg-panel p-4">
      <h4 className="text-sm font-semibold text-t1">{title}</h4>
      <p className="mt-0.5 text-xs text-t3">What should you have brought in? It comes up when you face this legend again.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((o) => {
          const qty = picked.get(o.name) ?? 0;
          return (
            <li key={o.name} className={`flex items-center gap-2 rounded-lg border p-1.5 pr-1 transition ${qty ? "border-brand-gold bg-accentbg" : "border-line"}`}>
              <button type="button" aria-pressed={qty > 0} onClick={() => set(o.name, qty ? 0 : o.qty)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left">
                <CardThumb card={o.card} />
                <span className={`min-w-0 text-xs font-semibold leading-snug ${qty ? "text-t1" : "text-t2"}`}>{o.name}</span>
              </button>
              <span className="flex shrink-0 items-center">
                <button type="button" aria-label={`One ${o.name} less`} disabled={!qty} onClick={() => set(o.name, qty - 1)} className={step}>
                  −
                </button>
                <span className={`num w-8 text-center text-xs font-bold ${qty ? "text-brand-gold" : "text-t3"}`}>
                  {qty}/{o.qty}
                </span>
                <button type="button" aria-label={`One ${o.name} more`} disabled={qty >= o.qty} onClick={() => set(o.name, qty + 1)} className={step}>
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type MatchActions = {
  decks: Deck[];
  deckLabel: (id: string) => string | undefined;
  legendCard: (name: string) => RiftCard | undefined;
  onDeck: (m: Match, deckId: string | null) => void;
  onNotes: (m: Match, notes: string) => void;
  onResult: (m: Match, result: MatchResult) => void;
  /** the sideboard you had in a game */
  sideboard: (m: Match) => SideOption[];
  onSideIn: (m: Match, cards: SideCard[]) => void;
  onDelete: (m: Match) => void;
  onSaveDeck: (side: MatchSide) => Promise<boolean>;
};

// Everything about one game: score, both sides, deck, notes.
function MatchDetail({ match, next, actions }: { match: Match; next: boolean; actions: MatchActions }) {
  const [notes, setNotes] = useState(match.notes);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const s = match.summary;
  const side = actions.sideboard(match);
  const facts = [
    s.wentFirst === null ? null : s.wentFirst ? "You went first" : "You went second",
    s.turns ? `${s.turns} turns` : null,
    minutes(s.durationMs),
    REASON[s.reason] ?? null,
  ].filter(Boolean);

  const saveDeck = async (key: "me" | "opp") => {
    if (await actions.onSaveDeck(s[key])) setSaved((cur) => ({ ...cur, [key]: true }));
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line bg-ink/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-t2">{facts.join(" · ")}</p>
        <ResultPicker value={match.result} onChange={(r) => actions.onResult(match, r)} />
      </div>
      {needsCheck(s) && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">⚠ The replay names no winner, so this comes from the score. Set it above if it&apos;s wrong.</p>}
      {s.scores.length > 1 && <ScoreChart scores={s.scores} me={s.me.name} opp={s.opp.name} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Side side={s.me} face={actions.legendCard(s.me.legend)} onSaveDeck={() => saveDeck("me")} saved={!!saved.me} />
        <Side side={s.opp} face={actions.legendCard(s.opp.legend)} onSaveDeck={() => saveDeck("opp")} saved={!!saved.opp} />
      </div>
      {side.length > 0 && (
        <SideboardPicker
          title={next ? `Sideboard for game ${s.gameNumber + 1}` : "Sideboard for next time"}
          options={side}
          value={s.sideIn ?? []}
          onChange={(cards) => actions.onSideIn(match, cards)}
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <Select
            value={match.deckId ?? ""}
            onChange={(v) => actions.onDeck(match, v || null)}
            ariaLabel="Deck you played"
            className="h-11 text-sm"
            options={[{ value: "", label: "No saved deck" }, ...deckOptions(actions.decks)]}
          />
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== match.notes && actions.onNotes(match, notes)}
          maxLength={2000}
          placeholder="Notes: what decided this game?"
          aria-label="Notes"
          className="h-11 min-w-0 rounded-lg border border-line bg-ink px-3 text-sm text-t1 placeholder:text-t3 sm:flex-1"
        />
        <button type="button" onClick={() => actions.onDelete(match)} className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-bad hover:text-bad">
          Delete
        </button>
      </div>
    </div>
  );
}

// The full word where there's room, its letter on a phone.
function Outcome({ result }: { result: MatchResult }) {
  return (
    <>
      <span className="hidden sm:block">
        <span className="block w-12">
          <ResultTag result={result} />
        </span>
      </span>
      <span className="sm:hidden">
        <ResultDot result={result} title={RESULT[result].label} />
      </span>
    </>
  );
}

// One line per match. A best-of-three is one line too, with a button per game;
// the details of the picked game open underneath.
export function MatchRow({ games, series, actions }: { games: Match[]; series?: Series; actions: MatchActions }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const first = games[0];
  const s = first.summary;
  const open = games.find((g) => g.id === openId);
  const result = series ? series.result : first.result;
  const deck = first.deckId ? actions.deckLabel(first.deckId) : undefined;
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const head = (
    <>
      <span aria-hidden="true" className={`w-1 shrink-0 self-stretch rounded-full ${result ? RESULT[result].bar : "bg-cavity"}`} />
      <LegendFace card={actions.legendCard(s.opp.legend)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-t1">{s.opp.legend}</span>
        <span className="num mt-0.5 block truncate text-xs text-t3">
          {series && <b className="mr-1.5 text-t2">{series.format.toUpperCase()}</b>}
          {deck ?? s.me.legend} vs {s.opp.name} · {time(first.playedAt)}
        </span>
      </span>
    </>
  );
  const score = (a: number, b: number) => <span className="num w-12 shrink-0 text-right font-display text-xl font-bold text-t1">{`${a}–${b}`}</span>;

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-panel">
      {series ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
          <div className="flex min-w-0 flex-1 basis-36 items-center gap-3 sm:basis-56">{head}</div>
          <div className="order-last flex w-full flex-wrap items-center gap-1.5 sm:order-none sm:w-auto">
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-label={`Game ${g.summary.gameNumber}: ${RESULT[g.result].label} ${g.summary.me.score} to ${g.summary.opp.score}`}
                aria-expanded={openId === g.id}
                onClick={() => toggle(g.id)}
                className={`num flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${
                  openId === g.id ? "border-brand-gold text-t1" : "border-line text-t2 hover:border-line2 hover:text-t1"
                }`}
              >
                <b className={g.result === "win" ? "text-ok" : g.result === "loss" ? "text-bad" : "text-t2"}>{RESULT[g.result].letter}</b>
                {g.summary.me.score}–{g.summary.opp.score}
                {needsCheck(g.summary) && (
                  <span title="Result taken from the score" className="text-warn">
                    ⚠
                  </span>
                )}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-2">
            {result ? <Outcome result={result} /> : <span className="rounded-md bg-cavity px-2 py-1 text-xs font-bold text-t2">Incomplete</span>}
            {score(series.wins, series.losses)}
          </span>
        </div>
      ) : (
        <button type="button" aria-expanded={!!open} onClick={() => toggle(first.id)} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-panel2">
          {head}
          {needsCheck(s) && (
            <span title="Result taken from the score" className="text-xs text-warn">
              ⚠
            </span>
          )}
          <span className="flex items-center gap-2">
            <Outcome result={first.result} />
            {score(s.me.score, s.opp.score)}
          </span>
        </button>
      )}
      {open && (
        <MatchDetail
          key={open.id}
          match={open}
          // a best-of-three always has a second game
          next={!!series && (open.summary.gameNumber === 1 || games.some((g) => g.summary.gameNumber > open.summary.gameNumber))}
          actions={actions}
        />
      )}
    </li>
  );
}
