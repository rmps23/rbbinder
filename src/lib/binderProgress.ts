import { setProgress } from "./setCollection";
import type { Binder, RiftCard, SetInfo } from "./types";

// Progress shown on a binder: one of each base card of its set, or - for a
// binder without a set - how much of the whole catalog it holds.
export function binderProgress(binder: Binder, cards: RiftCard[], sets: SetInfo[]) {
  if (binder.setId) {
    const p = setProgress(cards, binder.setId, Object.keys(binder.contents ?? {}));
    const name = sets.find((s) => s.id === binder.setId)?.name ?? binder.setId;
    return { completion: p.pct, label: `${p.have} / ${p.total} of ${name}` };
  }
  return { completion: cards.length ? binder.uniqueCount / cards.length : 0, label: undefined };
}
