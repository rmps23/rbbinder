"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/clientCache";
import { setFinishData, type Finish } from "@/lib/cardFinish";
import { setChampionNames } from "@/lib/deckRules";
import type { BulkMap, BulkVariant, PriceMode, PricesResponse, RiftCard, SetInfo } from "@/lib/types";

type AppData = {
  cards: RiftCard[];
  sets: SetInfo[];
  bulk: BulkMap;
  loading: boolean;
  // English-market prices in euros; null until they've loaded (or if unavailable).
  prices: PricesResponse | null;
  priceOf: (card: Pick<RiftCard, "id">, finish: Finish) => number | null;
  setBulkQty: (cardId: string, variant: BulkVariant, qty: number) => void;
  reloadCards: () => void;
  reloadPrices: () => void;
  // which Cardmarket figure the prices show (kept in this browser)
  priceMode: PriceMode;
  setPriceMode: (m: PriceMode) => void;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<RiftCard[]>([]);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [bulk, setBulk] = useState<BulkMap>({});
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [cardsVersion, setCardsVersion] = useState(0);
  const [pricesVersion, setPricesVersion] = useState(0);
  const [priceMode, setPriceModeState] = useState<PriceMode>("trend");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rbbinder:priceMode");
      if (saved === "trend" || saved === "avg7" || saved === "low") setPriceModeState(saved);
    } catch {
      // no storage - stay on the default
    }
  }, []);

  const setPriceMode = useCallback((m: PriceMode) => {
    setPriceModeState(m);
    try {
      localStorage.setItem("rbbinder:priceMode", m);
    } catch {
      // not remembered
    }
  }, []);
  const pending = useRef<Map<string, { cardId: string; variant: BulkVariant; qty: number }>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Stale-while-revalidate: the last known data is shown instantly from IndexedDB while fresh data loads.
  const gotFresh = useRef(false);
  const gotFreshPrices = useRef(false);
  const finishesRef = useRef<unknown>(undefined);
  type Snapshot = { cards: RiftCard[]; sets: SetInfo[]; finishes?: unknown; bulk: BulkMap };

  useEffect(() => {
    cacheGet<Snapshot>("app:v1").then((snap) => {
      if (!snap || gotFresh.current) return;
      finishesRef.current = snap.finishes;
      if (snap.finishes) setFinishData(snap.finishes as Parameters<typeof setFinishData>[0]);
      setChampionNames(snap.cards ?? []);
      setCards(snap.cards ?? []);
      setSets(snap.sets ?? []);
      setBulk(snap.bulk ?? {});
      setLoading(false);
    });
    cacheGet<PricesResponse>("prices:v1").then((p) => {
      if (p && !gotFreshPrices.current) setPrices(p);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cardsRes, bulkRes] = await Promise.all([fetch("/api/cards"), fetch("/api/bulk")]);
      if (cancelled) return;
      const cardsJson = cardsRes.ok ? await cardsRes.json() : { cards: [], sets: [] };
      finishesRef.current = cardsJson.finishes;
      if (cardsJson.finishes) setFinishData(cardsJson.finishes);
      const bulkJson = bulkRes.ok ? await bulkRes.json() : {};
      if (cancelled) return;
      gotFresh.current = true;
      setChampionNames(cardsJson.cards ?? []);
      setCards(cardsJson.cards ?? []);
      setSets(cardsJson.sets ?? []);
      setBulk(bulkJson);
      setLoading(false);
      if (cardsRes.ok && bulkRes.ok) cacheSet("app:v1", { cards: cardsJson.cards ?? [], sets: cardsJson.sets ?? [], finishes: cardsJson.finishes, bulk: bulkJson });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cardsVersion]);

  // Keep the cached snapshot's bulk in step with local edits, so a quick reload never flashes old counts.
  useEffect(() => {
    if (!gotFresh.current || cards.length === 0) return;
    cacheSet("app:v1", { cards, sets, finishes: finishesRef.current, bulk });
  }, [bulk, cards, sets]);

  // Prices load in parallel with the main data and never hold up the page.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices", { cache: pricesVersion ? "no-store" : "default" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.prices) return;
        gotFreshPrices.current = true;
        setPrices(data);
        cacheSet("prices:v1", data);
      })
      .catch(() => {
        // prices are optional - the UI just doesn't show them
      });
    return () => {
      cancelled = true;
    };
  }, [pricesVersion]);

  const priceOf = useCallback(
    (card: Pick<RiftCard, "id">, finish: Finish) => {
      const e = prices?.prices[card.id]?.[finish];
      if (!e) return null;
      if (priceMode === "low") return e.low ?? e.price;
      if (priceMode === "avg7") return e.avg7 ?? e.price;
      return e.price;
    },
    [prices, priceMode]
  );

  const reloadCards = useCallback(() => setCardsVersion((v) => v + 1), []);
  const reloadPrices = useCallback(() => setPricesVersion((v) => v + 1), []);

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
    <Ctx.Provider value={{ cards, sets, bulk, loading, prices, priceOf, setBulkQty, reloadCards, reloadPrices, priceMode, setPriceMode }}>{children}</Ctx.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
