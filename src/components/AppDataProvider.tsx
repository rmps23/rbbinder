"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { BulkMap, BulkVariant, RiftCard, SetInfo } from "@/lib/types";

type AppData = {
  cards: RiftCard[];
  sets: SetInfo[];
  bulk: BulkMap;
  loading: boolean;
  setBulkQty: (cardId: string, variant: BulkVariant, qty: number) => void;
  reloadCards: () => void;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<RiftCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [bulk, setBulk] = useState<BulkMap>({});
  const [loading, setLoading] = useState(true);
  const [cardsVersion, setCardsVersion] = useState(0);
  const pending = useRef<Map<string, { cardId: string; variant: BulkVariant; qty: number }>>(new Map());
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

  const flush = useCallback((key: string) => {
    const existingTimer = timers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      const entry = pending.current.get(key);
      pending.current.delete(key);
      timers.current.delete(key);
      if (entry === undefined) return;
      try {
        await fetch("/api/bulk", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch {
        // best-effort; optimistic UI already reflects the change locally
      }
    }, 350);
    timers.current.set(key, timer);
  }, []);

  const setBulkQty = useCallback(
    (cardId: string, variant: BulkVariant, qty: number) => {
      const safeQty = Math.max(0, Math.min(9999, Math.floor(qty)));
      setBulk((prev) => {
        const current = prev[cardId] ?? { normal: 0, foil: 0 };
        return { ...prev, [cardId]: { ...current, [variant]: safeQty } };
      });
      const key = `${cardId}:${variant}`;
      pending.current.set(key, { cardId, variant, qty: safeQty });
      flush(key);
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
