"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CollectionMap, QtyField, RiftCard, SetInfo } from "@/lib/types";

type AppData = {
  cards: RiftCard[];
  sets: SetInfo[];
  collection: CollectionMap;
  loading: boolean;
  setQty: (cardId: string, field: QtyField, qty: number) => void;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<RiftCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [collection, setCollection] = useState<CollectionMap>({});
  const [loading, setLoading] = useState(true);
  const pending = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cardsRes, setsRes, collectionRes] = await Promise.all([
        fetch("/data/cards.json"),
        fetch("/data/sets.json"),
        fetch("/api/collection"),
      ]);
      if (cancelled) return;
      const [cardsJson, setsJson, collectionJson] = await Promise.all([
        cardsRes.json(),
        setsRes.json(),
        collectionRes.ok ? collectionRes.json() : Promise.resolve({}),
      ]);
      if (cancelled) return;
      setCards(cardsJson);
      setSets(setsJson);
      setCollection(collectionJson);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback((cardId: string, field: QtyField) => {
    const key = `${cardId}:${field}`;
    const existingTimer = timers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      const qty = pending.current.get(key);
      pending.current.delete(key);
      timers.current.delete(key);
      if (qty === undefined) return;
      try {
        await fetch("/api/collection", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardId, field, qty }),
        });
      } catch {
        // best-effort; optimistic UI already reflects the change locally
      }
    }, 350);
    timers.current.set(key, timer);
  }, []);

  const setQty = useCallback(
    (cardId: string, field: QtyField, qty: number) => {
      const safeQty = Math.max(0, Math.min(9999, Math.floor(qty)));
      setCollection((prev) => {
        const current = prev[cardId] ?? { binder: 0, bulk: 0 };
        return { ...prev, [cardId]: { ...current, [field]: safeQty } };
      });
      pending.current.set(`${cardId}:${field}`, safeQty);
      flush(cardId, field);
    },
    [flush]
  );

  return (
    <Ctx.Provider value={{ cards, sets, collection, loading, setQty }}>{children}</Ctx.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
