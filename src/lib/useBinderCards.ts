"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BinderSlots } from "./types";

export function useBinderCards(binderId: string) {
  const [slots, setSlotsState] = useState<BinderSlots>({});
  const [loading, setLoading] = useState(true);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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

  const cancelPendingFlush = useCallback((position: number) => {
    const existing = timers.current.get(position);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(position);
    }
  }, []);

  const scheduleFlush = useCallback(
    (position: number, cardId: string | null, qty: number) => {
      cancelPendingFlush(position);
      const timer = setTimeout(() => {
        timers.current.delete(position);
        push(position, cardId, qty);
      }, 350);
      timers.current.set(position, timer);
    },
    [cancelPendingFlush, push]
  );

  // Places a card into a slot (or replaces whatever was there) at qty 1.
  // A decisive click, so it's sent right away instead of debounced.
  const placeCard = useCallback(
    (position: number, cardId: string) => {
      setSlotsState((prev) => ({ ...prev, [position]: { cardId, qty: 1 } }));
      cancelPendingFlush(position);
      push(position, cardId, 1);
    },
    [cancelPendingFlush, push]
  );

  // Adjusts how many copies sit in an already-filled slot; qty <= 0 empties it.
  const setQty = useCallback(
    (position: number, qty: number) => {
      setSlotsState((prev) => {
        const current = prev[position];
        if (!current) return prev;
        if (qty <= 0) {
          const next = { ...prev };
          delete next[position];
          scheduleFlush(position, null, 0);
          return next;
        }
        const safeQty = Math.min(9999, Math.floor(qty));
        scheduleFlush(position, current.cardId, safeQty);
        return { ...prev, [position]: { cardId: current.cardId, qty: safeQty } };
      });
    },
    [scheduleFlush]
  );

  const clearSlot = useCallback(
    (position: number) => {
      setSlotsState((prev) => {
        const next = { ...prev };
        delete next[position];
        return next;
      });
      cancelPendingFlush(position);
      push(position, null, 0);
    },
    [cancelPendingFlush, push]
  );

  return { slots, loading, placeCard, setQty, clearSlot };
}
