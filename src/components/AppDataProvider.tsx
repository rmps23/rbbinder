"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { QtyMap, RiftCard, SetInfo } from "@/lib/types";

type AppData = {
  cards: RiftCard[];
  sets: SetInfo[];
  bulk: QtyMap;
  loading: boolean;
  setBulkQty: (cardId: string, qty: number) => void;
  reloadCards: () => void;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<RiftCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [bulk, setBulk] = useState<QtyMap>({});
  const [loading, setLoading] = useState(true);
  const [cardsVersion, setCardsVersion] = useState(0);
  const pending = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cardsRes, bulkRes] = await Promise.all([fetch("/api/cards"), fetch("/api/bulk")]);
      if (cancelled) return;
      const cardsJson = cardsRes.ok ? await cardsRes.json() : { cards: [], sets: [] };
      const bulkJson = bulkRes.ok ? await bulkRes.json() : {};
      if (cancelled) return;
      setCards(cardsJson.cards ?? []);
      setSets(cardsJson.sets ?? []);
      setBulk(bulkJson);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cardsVersion]);

  const reloadCards = useCallback(() => setCardsVersion((v) => v + 1), []);

  const flush = useCallback((cardId: string) => {
    const existingTimer = timers.current.get(cardId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      const qty = pending.current.get(cardId);
      pending.current.delete(cardId);
      timers.current.delete(cardId);
      if (qty === undefined) return;
      try {
        await fetch("/api/bulk", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardId, qty }),
        });
      } catch {
        // best-effort; optimistic UI already reflects the change locally
      }
    }, 350);
    timers.current.set(cardId, timer);
  }, []);

  const setBulkQty = useCallback(
    (cardId: string, qty: number) => {
      const safeQty = Math.max(0, Math.min(9999, Math.floor(qty)));
      setBulk((prev) => ({ ...prev, [cardId]: safeQty }));
      pending.current.set(cardId, safeQty);
      flush(cardId);
    },
    [flush]
  );

  return (
    <Ctx.Provider value={{ cards, sets, bulk, loading, setBulkQty, reloadCards }}>{children}</Ctx.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
