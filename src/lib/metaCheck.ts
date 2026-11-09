// "Do I own this meta deck?": takes the decklists from Riot's Top Decks articles
// (see metaDecks.ts) and compares each one with what you own - bulk plus
// binders - so the site can say how many cards are missing for every list.

import { cardKey, displayName } from "./deck";
import { getMetaDecks, type MetaDeck } from "./metaDecks";
import { getBulk, getCardsAndSets, listBinders } from "./repo";
import { isRegularPrinting } from "./setCollection";
import { championNames, legendChampion } from "./wants";
import type { DeckEntry, RiftCard } from "./types";

export type MetaOption = {
  id: string;
  event: string;
  date: string;
  url: string;
  player: string;
  placement: string;
  section: "top8" | "best";
  legendId: string; // a printing of the legend, to show its art
  legendKey: string; // groups every printing of the same legend
  legendName: string;
  legendOwned: boolean;
  champion: string | null;
  have: number; // copies of the list you own (legend, champion, main deck, battlefields)
  total: number;
  missing: { name: string; qty: number }[];
};

// Cards you can play: everything in the bulk AND in your binders, but only
// regular printings - alternate arts, overnumbered, signature and showcase
// copies are collection pieces and never leave the binder.
async function loadOwned() {
  const [{ cards }, bulk, binders] = await Promise.all([getCardsAndSets(), getBulk(), listBinders()]);
  const copies = new Map<string, number>(); // card id -> copies
  for (const [id, e] of Object.entries(bulk)) copies.set(id, (copies.get(id) ?? 0) + (e.normal ?? 0) + (e.foil ?? 0));
  for (const b of binders) for (const [id, q] of Object.entries(b.contents ?? {})) copies.set(id, (copies.get(id) ?? 0) + q);

  const owned = new Map<string, number>(); // card name key -> copies
  const printing = new Map<string, RiftCard>(); // key -> the printing you have most of
  const best = new Map<string, number>();
  for (const c of cards) {
    const q = copies.get(c.id) ?? 0;
    if (q <= 0 || !isRegularPrinting(c)) continue;
    const k = cardKey(c);
    owned.set(k, (owned.get(k) ?? 0) + q);
    if (q > (best.get(k) ?? 0)) {
      best.set(k, q);
      printing.set(k, c);
    }
  }
  return { cards, owned, printing };
}

type Owned = Awaited<ReturnType<typeof loadOwned>>;

// "Kennen, Heart of the Tempest" - the champion tag, not a faction tag like "Yordle".
function legendLabel(legend: RiftCard, champs: Set<string>) {
  const champ = legendChampion(legend, champs);
  return champ ? `${champ}, ${displayName(legend)}` : displayName(legend);
}

const PLAYED: DeckEntry["zone"][] = ["legend", "champion", "main", "battlefield"];

function coverage(meta: MetaDeck, o: Owned, cardById: Map<string, RiftCard>) {
  const need = new Map<string, { card: RiftCard; qty: number }>();
  for (const e of meta.entries) {
    const card = cardById.get(e.cardId);
    if (!card || !PLAYED.includes(e.zone)) continue;
    const k = cardKey(card);
    const cur = need.get(k);
    if (cur) cur.qty += e.qty;
    else need.set(k, { card, qty: e.qty });
  }
  let have = 0;
  let total = 0;
  const missing: { name: string; qty: number }[] = [];
  for (const [k, { card, qty }] of need) {
    const got = Math.min(qty, o.owned.get(k) ?? 0);
    have += got;
    total += qty;
    if (got < qty) missing.push({ name: displayName(card), qty: qty - got });
  }
  missing.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  return { have, total, missing };
}

export async function metaOptions(refresh = false) {
  const o = await loadOwned();
  const cache = await getMetaDecks(o.cards, refresh);
  const cardById = new Map(o.cards.map((c) => [c.id, c]));
  const champs = championNames(o.cards);
  const decks: MetaOption[] = cache.decks.flatMap((d) => {
    const legendEntry = d.entries.find((e) => e.zone === "legend");
    const legend = legendEntry && cardById.get(legendEntry.cardId);
    if (!legend) return [];
    const champ = d.entries.find((e) => e.zone === "champion");
    const champCard = champ && cardById.get(champ.cardId);
    const key = cardKey(legend);
    return [
      {
        id: d.id,
        event: d.event,
        date: d.date,
        url: d.url,
        player: d.player,
        placement: d.placement,
        section: d.section,
        legendId: (o.printing.get(key) ?? legend).id,
        legendKey: key,
        legendName: legendLabel(legend, champs),
        legendOwned: (o.owned.get(key) ?? 0) > 0,
        champion: champCard ? displayName(champCard) : null,
        ...coverage(d, o, cardById),
      },
    ];
  });
  // closest to complete first, then newest
  decks.sort((a, b) => a.missing.reduce((n, m) => n + m.qty, 0) - b.missing.reduce((n, m) => n + m.qty, 0) || b.date.localeCompare(a.date));
  return { fetchedAt: cache.fetchedAt, events: cache.events, decks };
}
