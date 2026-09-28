"use client";

import { useCallback, useEffect, useState } from "react";
import type { BinderSlots } from "./types";

export function useBinderCards(binderId: string) {
  const [slots, setSlotsState] = useState<BinderSlots>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/binders/${binderId}/cards`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (cancelled) return;
        setSlotsState(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [binderId]);

  const push = useCallback(
    (position: number, cardId: string | null, qty: number) => {
      fetch(`/api/binders/${binderId}/cards`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ position, cardId, qty }),
      }).catch(() => {
        // best-effort; optimistic UI already reflects the change locally
      });
    },
    [binderId]
  );

  // Places a card into a slot (or replaces whatever was there) at qty 1.
  const placeCard = useCallback(
    (position: number, cardId: string) => {
      setSlotsState((prev) => ({ ...prev, [position]: { cardId, qty: 1 } }));
      push(position, cardId, 1);
    },
    [push]
  );

  // Removes whatever card sits in a slot, emptying it.
  const clearSlot = useCallback(
    (position: number) => {
      setSlotsState((prev) => {
        if (!prev[position]) return prev;
        const next = { ...prev };
        delete next[position];
        return next;
      });
      push(position, null, 0);
    },
    [push]
  );

  // Drag-and-drop onto another slot: swaps whatever sits in the two slots
  // (dropping onto an empty slot just moves the card there).
  const swapSlots = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      setSlotsState((prev) => {
        const slotFrom = prev[from] ?? null;
        const slotTo = prev[to] ?? null;
        if (!slotFrom && !slotTo) return prev;

        const next = { ...prev };
        if (slotTo) next[from] = slotTo;
        else delete next[from];
        if (slotFrom) next[to] = slotFrom;
        else delete next[to];

        push(from, slotTo?.cardId ?? null, slotTo?.qty ?? 0);
        push(to, slotFrom?.cardId ?? null, slotFrom?.qty ?? 0);
        return next;
      });
    },
    [push]
  );

  // Drag-and-drop onto the gutter between two pages: the dragged card is
  // pulled out of its slot and inserted right at the page boundary, and
  // every filled slot from that point onward is pushed one position along.
  const insertAtBoundary = useCallback(
    (from: number, insertPosition: number) => {
      setSlotsState((prev) => {
        const moving = prev[from];
        if (!moving) return prev;

        const next: BinderSlots = {};
        const writes: { position: number; cardId: string | null; qty: number }[] = [
          { position: from, cardId: null, qty: 0 },
        ];

        for (const [key, slot] of Object.entries(prev)) {
          const position = Number(key);
          if (position === from) continue;
          if (position >= insertPosition) {
            next[position + 1] = slot;
            writes.push({ position: position + 1, cardId: slot.cardId, qty: slot.qty });
          } else {
            next[position] = slot;
          }
        }
        next[insertPosition] = moving;
        writes.push({ position: insertPosition, cardId: moving.cardId, qty: moving.qty });

        for (const w of writes) push(w.position, w.cardId, w.qty);
        return next;
      });
    },
    [push]
  );

  return { slots, loading, placeCard, clearSlot, swapSlots, insertAtBoundary };
}
