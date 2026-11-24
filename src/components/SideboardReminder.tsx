"use client";

import { useMemo, useState } from "react";
import { CardThumb, LegendFace } from "./MatchRow";
import { Select } from "./Select";
import { cardKey, representative, type DeckIndex } from "@/lib/deck";
import { deckLabels } from "@/lib/deckVersions";
import { record, sideReminders, tally } from "@/lib/matchStats";
import type { Deck, DeckEntry, Match, RiftCard } from "@/lib/types";

const FACES = 6; // legends with reminders shown as shortcuts

// Pick the legend you're up against: the cards you said, after earlier games
// against it, that you should have sided in.
export function SideboardReminder({
  matches,
  decks,
  deckId,
  cards,
  index,
  legendCard,
  sideCards,
}: {
  matches: Match[]; // newest first
  decks: Deck[];
  /** the deck you're playing, if one is filtered ("" = the last one you played) */
  deckId: string;
  cards: RiftCard[];
  index: DeckIndex;
  legendCard: (name: string) => RiftCard | undefined;
  sideCards: (entries: DeckEntry[]) => { name: string; qty: number }[];
}) {
  const [legend, setLegend] = useState("");

  const deck = decks.find((d) => d.id === (deckId || matches.find((m) => m.deckId)?.deckId));
  // Every version of the deck counts; without a saved deck, the games with the same legend of yours.
  const mine = useMemo(() => {
    if (!deck) return matches.filter((m) => m.summary.me.legend === matches[0]?.summary.me.legend);
    const family = new Set(decks.filter((d) => d.familyId === deck.familyId).map((d) => d.id));
    return matches.filter((m) => m.deckId && family.has(m.deckId));
  }, [matches, decks, deck]);

  // Legends you've met first, then the rest, written as in the replays: "Ahri,
  // Nine-Tailed Fox". The card only has the title; its champion is one of its tags.
  const options = useMemo(() => {
    const met = [...new Set(matches.map((m) => m.summary.opp.legend))].sort();
    const champions = new Set(cards.filter((c) => c.types.includes("unit") && c.superTypes?.includes("champion")).map((c) => c.name));
    const rest = new Set<string>();
    for (const c of cards) {
      if (!c.types.includes("legend") || champions.has(c.name)) continue; // some promos are named by the champion: same legends again
      const champion = c.tags.find((t) => champions.has(t));
      if (champion) rest.add(`${champion}, ${c.name}`);
    }
    for (const n of met) rest.delete(n);
    return [...met, ...[...rest].sort()].map((n) => ({ value: n, label: n }));
  }, [matches, cards]);

  const marked = useMemo(() => [...new Set(mine.filter((m) => m.summary.sideIn?.length).map((m) => m.summary.opp.legend))], [mine]);
  const games = useMemo(() => mine.filter((m) => m.summary.opp.legend === legend), [mine, legend]);
  const reminders = useMemo(() => sideReminders(games), [games]);
  // What the deck's sideboard has now: it may have changed since.
  const side = useMemo(() => new Map(deck ? sideCards(deck.entries).map((c) => [c.name, c.qty]) : []), [deck, sideCards]);
  const label = deck ? (deckLabels(decks).get(deck.id) ?? deck.name) : "";

  return (
    <section aria-label="Sideboard reminder" className="flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label">Sideboard reminder</h2>
        {label && <span className="truncate text-xs text-t3">{label}</span>}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        {legend && <LegendFace card={legendCard(legend)} className="h-11 w-11" />}
        <div className="min-w-0 flex-1">
          <Select value={legend} onChange={setLegend} placeholder="Who are you up against?" searchPlaceholder="Search legends…" ariaLabel="Legend you're up against" className="h-11 text-sm" options={options} />
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-center" aria-live="polite">
        {!legend ? (
          marked.length ? (
            <>
              <p className="text-xs text-t3">You have reminders against:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {marked.slice(0, FACES).map((n) => (
                  <button key={n} type="button" title={n} aria-label={n} onClick={() => setLegend(n)} className="rounded-lg transition hover:opacity-80">
                    <LegendFace card={legendCard(n)} className="h-11 w-11" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-t3">Open a game and pick the cards you should have sided in. They&apos;ll show up here when you face that legend again.</p>
          )
        ) : reminders.length ? (
          <>
            <p className="text-xs text-t3">
              Bring in <span className="num">· {record(tally(games))} so far</span>
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {reminders.map((r) => {
                const has = side.get(r.name) ?? 0;
                const key = index.lookup.get(cardKey({ name: r.name, subtitle: null }));
                return (
                  <li key={r.name} className="flex items-center gap-3">
                    <CardThumb card={key ? representative(index, key) : undefined} />
                    <span className="num w-6 shrink-0 font-display text-lg font-bold text-brand-gold">{r.qty}×</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-t1" title={r.name}>
                        {r.name}
                      </span>
                      <span className={`block text-xs ${deck && !has ? "text-warn" : "text-t3"}`}>
                        {deck && !has ? `Not in the ${label} sideboard` : r.games === 1 ? "Noted after 1 game" : `Noted after ${r.games} games`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-t3">
            {games.length
              ? `No cards noted against this legend yet (${record(tally(games))}). Open one of those games to pick them.`
              : "You haven't played this legend with this deck yet."}
          </p>
        )}
      </div>
    </section>
  );
}
