import { typicalFinish, type Finish } from "./cardFinish";
import type { BulkMap, RiftCard } from "./types";

type PriceOf = (card: Pick<RiftCard, "id">, finish: Finish) => number | null;

export type Valuation = { value: number; copies: number; unique: number; unpriced: number };

const empty = (): Valuation => ({ value: 0, copies: 0, unique: 0, unpriced: 0 });

function add(v: Valuation, price: number | null, qty: number) {
  v.copies += qty;
  if (price === null) v.unpriced += qty;
  else v.value += price * qty;
}

// Bulk worth, in total and per expansion (set id).
export function valueBulk(cards: RiftCard[], bulk: BulkMap, priceOf: PriceOf) {
  const total = empty();
  const bySet = new Map<string, Valuation & { name: string }>();
  for (const card of cards) {
    const entry = bulk[card.id];
    if (!entry || (entry.normal <= 0 && entry.foil <= 0)) continue;
    const set = bySet.get(card.set.id) ?? { ...empty(), name: card.set.name };
    total.unique++;
    set.unique++;
    for (const finish of ["normal", "foil"] as const) {
      const qty = entry[finish] ?? 0;
      if (qty <= 0) continue;
      const price = priceOf(card, finish);
      add(total, price, qty);
      add(set, price, qty);
    }
    bySet.set(card.set.id, set);
  }
  return { total, bySet };
}

// Worth of a binder's cards (id -> copies). Slots don't record a finish, so
// each card is valued in the finish it typically comes in.
export function valueContents(contents: Record<string, number> | undefined, cardById: Map<string, RiftCard>, priceOf: PriceOf) {
  const v = empty();
  for (const [id, qty] of Object.entries(contents ?? {})) {
    const card = cardById.get(id);
    if (!card || qty <= 0) continue;
    v.unique++;
    add(v, priceOf(card, typicalFinish(card)), qty);
  }
  return v;
}
