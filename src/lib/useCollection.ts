"use client";

import { useMemo } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { cardKey } from "./deck";
import { isRegularPrinting } from "./setCollection";
import { useBinders } from "./useBinders";

// Copies you can play, per card name: bulk + binders, regular printings only
// (alt arts, overnumbered, signature and showcase copies stay in the binder).
export function useCollection() {
  const { cards, bulk } = useAppData();
  const { binders, loading } = useBinders();
  const ownedByKey = useMemo(() => {
    const copies = new Map<string, number>();
    for (const [id, e] of Object.entries(bulk)) copies.set(id, (copies.get(id) ?? 0) + (e.normal ?? 0) + (e.foil ?? 0));
    for (const b of binders) for (const [id, q] of Object.entries(b.contents ?? {})) copies.set(id, (copies.get(id) ?? 0) + q);
    const m = new Map<string, number>();
    for (const c of cards) {
      const q = copies.get(c.id) ?? 0;
      if (q > 0 && isRegularPrinting(c)) m.set(cardKey(c), (m.get(cardKey(c)) ?? 0) + q);
    }
    return m;
  }, [cards, bulk, binders]);
  return { ownedByKey, loading };
}
