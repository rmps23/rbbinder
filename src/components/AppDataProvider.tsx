"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HIDDEN_SET_IDS } from "@/lib/setCollection";
import { cacheGet, cacheSet } from "@/lib/clientCache";
import { setFinishData, type Finish } from "@/lib/cardFinish";
import { setChampionNames } from "@/lib/deckRules";
import { setRank } from "@/lib/style";
import imageFixes from "@/lib/cardImageFixes.json";
import type { BulkMap, BulkVariant, PriceMode, PricesResponse, RiftCard, SetInfo } from "@/lib/types";

type AppData = {
  cards: RiftCard[];
  sets: SetInfo[];
  bulk: BulkMap;
  loading: boolean;
  // English-market prices in euros; null until they've loaded (or if unavailable).
  prices: PricesResponse | null;
  priceOf: (card: Pick<RiftCard, "id">, finish: Finish) => number | null;
  // Picture to use when a card's own one is missing (same card, regular printing), or null.
  imageFallbackOf: (card: Pick<RiftCard, "id">) => string | null;
  setBulkQty: (cardId: string, variant: BulkVariant, qty: number) => void;
  reloadCards: () => void;
  reloadPrices: () => void;
  // which Cardmarket figure the prices show (kept in this browser)
  priceMode: PriceMode;
  setPriceMode: (m: PriceMode) => void;
};

const Ctx = createContext<AppData | null>(null);
// On its own: every card picture reads it, and they shouldn't redraw when a count changes.
const ImageCtx = createContext<AppData["imageFallbackOf"]>(() => null);

// The card catalog as kept in this browser, with the tag that tells whether it's still the current one.
type Catalog = { cards: RiftCard[]; sets: SetInfo[]; finishes?: Parameters<typeof setFinishData>[0]; etag: string };

// Pictures TCGplayer doesn't have (its CDN answers 403), taken from Riftcodex by card code / TCGplayer id.
const IMAGE_FIXES = imageFixes as Record<string, string>;
const withImageFixes = (cards: RiftCard[]): RiftCard[] =>
  cards.map((c) => (IMAGE_FIXES[c.id] ? { ...c, image: { ...c.image, url: IMAGE_FIXES[c.id] } } : c));

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
  useEffect(() => {
    cacheGet<PricesResponse>("prices:v1").then((p) => {
      if (p && !gotFreshPrices.current) setPrices(p);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const show = (c: Catalog) => {
      if (c.finishes) setFinishData(c.finishes);
      setChampionNames(c.cards);
      setCards(withImageFixes(c.cards));
      setSets(c.sets);
    };
    async function load() {
      const bulkReq = fetch("/api/bulk").catch(() => null);
      const [catalog, knownBulk] = await Promise.all([cacheGet<Catalog>("catalog:v1"), cacheGet<BulkMap>("bulk:v1")]);
      if (cancelled) return;
      if (catalog && !gotFresh.current) {
        show(catalog);
        setBulk(knownBulk ?? {});
        setLoading(false);
      }
      // the catalog we have is usually still the current one (304): then there's nothing to read or redraw
      const [cardsRes, bulkRes] = await Promise.all([
        fetch(cardsVersion ? "/api/cards?fresh=1" : "/api/cards", catalog ? { headers: { "if-none-match": catalog.etag } } : undefined).catch(() => null),
        bulkReq,
      ]);
      const [cardsJson, bulkJson] = await Promise.all([cardsRes?.ok ? cardsRes.json() : null, bulkRes?.ok ? bulkRes.json() : null]);
      if (cancelled) return;
      if (bulkJson) {
        gotFresh.current = true;
        setBulk(bulkJson);
      }
      if (cardsJson) {
        const next: Catalog = { cards: cardsJson.cards ?? [], sets: cardsJson.sets ?? [], finishes: cardsJson.finishes, etag: cardsRes?.headers.get("etag") ?? "" };
        show(next);
        cacheSet("catalog:v1", next);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cardsVersion]);

  // Keep the cached counts in step with local edits, so a quick reload never flashes old ones.
  useEffect(() => {
    if (gotFresh.current) cacheSet("bulk:v1", bulk);
  }, [bulk]);

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

  // For cards whose picture comes from TCGplayer (and can be missing there): the Riot picture of the same card.
  const imageFallbacks = useMemo(() => {
    const norm = (c: RiftCard) => `${c.name} ${c.subtitle ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const riot = new Map<string, string>();
    for (const c of cards) {
      const url = c.image.url;
      if (!url || url.includes("tcgplayer")) continue;
      const k = norm(c);
      // prefer the plain numbered printing over alternates
      if (!riot.has(k) || (/^[A-Z0-9]+-\d+\/\d+$/.test(c.publicCode) && !riot.has(k + "!"))) {
        riot.set(k, url);
        if (/^[A-Z0-9]+-\d+\/\d+$/.test(c.publicCode)) riot.set(k + "!", "1");
      }
    }
    const out = new Map<string, string>();
    for (const c of cards) if (c.image.url?.includes("tcgplayer")) {
      const u = riot.get(norm(c));
      if (u) out.set(c.id, u);
    }
    return out;
  }, [cards]);
  const imageFallbackOf = useCallback((card: Pick<RiftCard, "id">) => imageFallbacks.get(card.id) ?? null, [imageFallbacks]);

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

  // Set lists everywhere (dashboard, bulk tabs, set pickers) skip the hidden sets.
  const visibleSets = useMemo(() => sets.filter((s) => !HIDDEN_SET_IDS.has(s.id)).sort((a, b) => setRank(a.id) - setRank(b.id)), [sets]);

  const value = useMemo(
    () => ({ cards, sets: visibleSets, bulk, loading, prices, priceOf, imageFallbackOf, setBulkQty, reloadCards, reloadPrices, priceMode, setPriceMode }),
    [cards, visibleSets, bulk, loading, prices, priceOf, imageFallbackOf, setBulkQty, reloadCards, reloadPrices, priceMode, setPriceMode]
  );
  return (
    <Ctx.Provider value={value}>
      <ImageCtx.Provider value={imageFallbackOf}>{children}</ImageCtx.Provider>
    </Ctx.Provider>
  );
}

export const useImageFallback = () => useContext(ImageCtx);

export function useAppData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
