"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QtyMap } from "./types";

export function useBinderCards(binderId: string) {
  const [qty, setQtyState] = useState<QtyMap>({});
  const [loading, setLoading] = useState(true);
  const pending = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/binders/${binderId}/cards`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (cancelled) return;
        setQtyState(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [binderId]);

  const flush = useCallback(
    (cardId: string) => {
      const existingTimer = timers.current.get(cardId);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        const q = pending.current.get(cardId);
        pending.current.delete(cardId);
        timers.current.delete(cardId);
        if (q === undefined) return;
        try {
          await fetch(`/api/binders/${binderId}/cards`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cardId, qty: q }),
          });
        } catch {
          // best-effort; optimistic UI already reflects the change locally
        }
      }, 350);
      timers.current.set(cardId, timer);
    },
    [binderId]
  );

  const setQty = useCallback(
    (cardId: string, q: number) => {
      const safeQty = Math.max(0, Math.min(9999, Math.floor(q)));
      setQtyState((prev) => ({ ...prev, [cardId]: safeQty }));
      pending.current.set(cardId, safeQty);
      flush(cardId);
    },
    [flush]
  );

  return { qty, loading, setQty };
}
