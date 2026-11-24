"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardImage } from "./CardImage";
import { LegendFace } from "./MatchRow";
import { Select } from "./Select";
import { cardKey, displayName, representative, type DeckIndex } from "@/lib/deck";
import { record, tally } from "@/lib/matchStats";
import type { Deck, DeckZone, Match, RiftCard, SideCard, SidePlan } from "@/lib/types";

const EMPTY: SidePlan = { in: [], out: [], note: "" };
const isEmpty = (p: SidePlan) => !p.in.length && !p.out.length && !p.note;
const total = (cards: SideCard[]) => cards.reduce((n, c) => n + c.qty, 0);

function Thumb({ card }: { card: RiftCard | undefined }) {
  return (
    <span className="relative block h-11 w-8 shrink-0 overflow-hidden rounded bg-cavity ring-1 ring-line2">
      {card?.image.url && <CardImage card={card} alt="" fill sizes="64px" className="object-cover" />}
    </span>
  );
}

type Listed = SideCard & { card: RiftCard | undefined };

// Cards to choose from, with how many of each.
function Picker({ title, options, value, onChange }: { title: string; options: Listed[]; value: SideCard[]; onChange: (cards: SideCard[]) => void }) {
  const picked = new Map(value.map((c) => [c.name, c.qty]));
  function set(name: string, qty: number) {
    const next = new Map(picked);
    if (qty > 0) next.set(name, qty);
    else next.delete(name);
    onChange([...next].map(([n, q]) => ({ name: n, qty: q })));
  }
  const step = "flex h-11 w-9 items-center justify-center rounded-md text-base text-t2 transition hover:bg-cavity hover:text-t1 disabled:opacity-30 sm:h-9";
  return (
    <div>
      <h3 className="flex items-baseline justify-between text-xs font-semibold text-t2">
        {title} <span className="num text-t3">{total(value)}</span>
      </h3>
      {/* tall lists scroll on their own, so both stay in view */}
      <ul className="mt-1.5 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
        {options.map((o) => {
          const qty = picked.get(o.name) ?? 0;
          return (
            <li key={o.name} className={`flex items-center gap-1 rounded-lg border p-1 transition ${qty ? "border-brand-gold bg-accentbg" : "border-line"}`}>
              <button type="button" aria-pressed={qty > 0} onClick={() => set(o.name, qty ? 0 : o.qty)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left">
                <Thumb card={o.card} />
                <span className={`min-w-0 text-xs font-semibold leading-snug ${qty ? "text-t1" : "text-t2"}`}>{o.name}</span>
              </button>
              <button type="button" aria-label={`One ${o.name} less`} disabled={!qty} onClick={() => set(o.name, qty - 1)} className={step}>
                −
              </button>
              <span className={`num w-7 text-center text-xs font-bold ${qty ? "text-brand-gold" : "text-t3"}`}>
                {qty}/{o.qty}
              </span>
              <button type="button" aria-label={`One ${o.name} more`} disabled={qty >= o.qty} onClick={() => set(o.name, qty + 1)} className={step}>
                +
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Pick the legend you're up against: what comes in from the sideboard and what
// goes out. The plans belong to the deck; a new version starts with them.
export function SideboardGuide({
  deck,
  label,
  matches,
  familyOf,
  cards,
  cardById,
  index,
  legendCard,
  onSave,
}: {
  deck: Deck | undefined;
  /** the deck's name with its version */
  label: string;
  matches: Match[];
  familyOf: Map<string, string>;
  cards: RiftCard[];
  cardById: Map<string, RiftCard>;
  index: DeckIndex;
  legendCard: (name: string) => RiftCard | undefined;
  onSave: (deck: Deck, legend: string, plan: SidePlan) => void;
}) {
  const [legend, setLegend] = useState("");
  const [draft, setDraft] = useState<SidePlan | null>(null); // while editing
  const guide = deck?.guide ?? {};
  const plan = draft ?? guide[legend] ?? EMPTY;

  // A few clicks in a row are one save, sent even when leaving meanwhile.
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    pending.current?.();
    pending.current = null;
  };
  useEffect(() => flush, []);

  function change(next: SidePlan) {
    if (!deck) return;
    setDraft(next);
    pending.current = () => onSave(deck, legend, next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  function pick(next: string) {
    flush();
    setDraft(null);
    setLegend(next);
  }

  // The deck's cards by name, whatever the printing.
  const listed = useMemo(() => {
    return (zones: DeckZone[]): Listed[] => {
      const out = new Map<string, Listed>();
      for (const e of deck?.entries ?? []) {
        const card = zones.includes(e.zone) ? cardById.get(e.cardId) : undefined;
        if (!card) continue;
        const had = out.get(cardKey(card));
        if (had) had.qty += e.qty;
        else out.set(cardKey(card), { name: displayName(card), qty: e.qty, card });
      }
      return [...out.values()].sort((a, b) => (a.card?.energy ?? 0) - (b.card?.energy ?? 0) || a.name.localeCompare(b.name));
    };
  }, [deck, cardById]);
  const side = useMemo(() => listed(["sideboard"]), [listed]);
  const main = useMemo(() => listed(["main"]), [listed]);
  const cardOf = (name: string) => {
    const key = index.lookup.get(cardKey({ name, subtitle: null }));
    return key ? representative(index, key) : undefined;
  };

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

  const planned = Object.keys(guide).filter((n) => !isEmpty(guide[n])).sort();
  // with any version of the deck
  const games = matches.filter((m) => m.summary.opp.legend === legend && m.deckId && familyOf.get(m.deckId) === deck?.familyId);
  const diff = total(plan.in) - total(plan.out);

  const rows = (list: SideCard[], have: Listed[], missing: string) => (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {list.map((c) => {
        const has = have.some((h) => h.name === c.name);
        return (
          <li key={c.name} className="flex items-center gap-2.5">
            <Thumb card={cardOf(c.name)} />
            <span className="num w-6 shrink-0 font-display text-base font-bold text-t1">{c.qty}×</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-t1" title={c.name}>
                {c.name}
              </span>
              {!has && <span className="block text-xs text-warn">{missing}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-label="Sideboard" className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label">Sideboard</h2>
        {deck && (
          <Link href={`/decks/${deck.id}`} title="Open the deck to change its sideboard cards" className="truncate text-xs font-semibold text-brand-gold hover:underline">
            {label}
          </Link>
        )}
      </div>

      {!deck ? (
        <p className="mt-3 text-xs leading-relaxed text-t3">Save your deck in Decks to plan its sideboard here.</p>
      ) : (
        <>
          <div className="mt-2.5 flex items-center gap-2.5">
            {legend && <LegendFace card={legendCard(legend)} className="h-11 w-11" />}
            <div className="min-w-0 flex-1">
              <Select value={legend} onChange={pick} placeholder="Who are you up against?" searchPlaceholder="Search legends…" ariaLabel="Legend you're up against" className="h-11 text-sm" options={options} />
            </div>
          </div>

          {!legend ? (
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-t3">{planned.length ? "Your plans:" : "Pick a legend to plan what comes in and what goes out."}</p>
              {planned.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {planned.map((n) => (
                    <button key={n} type="button" title={n} aria-label={n} onClick={() => pick(n)} className="rounded-lg transition hover:opacity-80">
                      <LegendFace card={legendCard(n)} className="h-11 w-11" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : draft ? (
            <div className="mt-4 flex flex-col gap-4">
              <Picker title="In, from the sideboard" options={side} value={plan.in} onChange={(list) => change({ ...plan, in: list })} />
              <Picker title="Out, from the main deck" options={main} value={plan.out} onChange={(list) => change({ ...plan, out: list })} />
              <label className="block text-xs font-semibold text-t2">
                Note
                <textarea
                  value={plan.note}
                  onChange={(e) => change({ ...plan, note: e.target.value })}
                  maxLength={300}
                  rows={2}
                  className="mt-1.5 w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm font-normal text-t1"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span role="status" className={`num text-xs ${diff ? "text-warn" : "text-t3"}`}>
                  {diff === 0 ? "As many in as out" : diff > 0 ? `${diff} more in than out` : `${-diff} more out than in`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    flush();
                    setDraft(null);
                  }}
                  className="btn-3d h-10 rounded-lg px-5 font-display text-xs font-semibold uppercase tracking-wide"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {isEmpty(plan) ? (
                <p className="text-xs leading-relaxed text-t3">No plan against this legend yet.</p>
              ) : (
                <>
                  {plan.in.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ok">In</h3>
                      {rows(plan.in, side, `Not in the ${label} sideboard`)}
                    </div>
                  )}
                  {plan.out.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-bad">Out</h3>
                      {rows(plan.out, main, `Not in the ${label} main deck`)}
                    </div>
                  )}
                  {plan.note && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-t2">{plan.note}</p>}
                </>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="num text-xs text-t3">{games.length ? `${record(tally(games))} against it` : "No games against it yet"}</span>
                <button
                  type="button"
                  onClick={() => setDraft(plan)}
                  className="h-10 rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-line2 hover:text-t1"
                >
                  {isEmpty(plan) ? "Add a plan" : "Edit"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
