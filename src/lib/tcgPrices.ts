// Prices for every card, in euros.
//
// Preferred source: Cardmarket's public price guide ("price trend"), which is
// what you see on cardmarket.com. Its product list has no collector numbers, so
// cards are linked to products by the "Update Cardmarket links" button on the Maintenance page
// (cardmarketMap.json); about 87% of cards are linked. Everything else - and
// any link whose price looks implausible next to TCGplayer's - uses TCGplayer.
//
// Fallback source: TCGplayer (an English-language marketplace) through the free public
// TCGCSV mirror, which republishes TCGplayer's product list and prices daily.
// Products are matched to our catalog by their printed collector number
// (e.g. "SFD-223*/221"), which is exact. Prices are in USD, so they're
// converted with the ECB reference rate (frankfurter.dev).
//
// The price shown is TCGplayer's "market price": the average of recent sales
// (falling back to the mid and then the lowest listing when there are none).

import { availableFinishes, setFinishData } from "./cardFinish";
import { getCardmarketMap, getFinishData } from "./overrides";
import { getCardsAndSets } from "./repo";
import type { CardPrices, PricesResponse } from "./types";

const TCGCSV = "https://tcgcsv.com/tcgplayer/89"; // 89 = Riftbound
const TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_USD_TO_EUR = 0.89;
const CARDMARKET = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json";

type Guide = Record<string, number | null> & { idProduct: number };

// Cardmarket's own price: the "trend" (what the site shows), then the 30-day
// and 7-day averages and finally the cheapest listing when there's no trend.
function cardmarketPrice(
  g: Guide,
  finish: "normal" | "foil"
): { price: number; low: number | null; avg1?: number; avg7?: number; avg30?: number } | null {
  const suffix = finish === "foil" ? "-foil" : "";
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = g[`${k}${suffix}`];
      if (typeof v === "number" && v > 0) return v;
    }
    return null;
  };
  const price = pick("trend", "avg30", "avg7", "low");
  if (price === null) return null;
  const extra = { avg1: pick("avg1"), avg7: pick("avg7"), avg30: pick("avg30") };
  return {
    price,
    low: pick("low"),
    ...(extra.avg1 !== null && { avg1: extra.avg1 }),
    ...(extra.avg7 !== null && { avg7: extra.avg7 }),
    ...(extra.avg30 !== null && { avg30: extra.avg30 }),
  };
}

type Group = { groupId: number; abbreviation: string; publishedOn: string };
type Product = { productId: number; extendedData?: { name: string; value: string }[] };
type PriceRow = {
  productId: number;
  subTypeName: string;
  lowPrice: number | null;
  midPrice: number | null;
  marketPrice: number | null;
};

let cache: { at: number; data: PricesResponse } | null = null;
let inflight: Promise<PricesResponse> | null = null;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (RBBinder price fetch)" }, cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function getRate(): Promise<{ rate: number; date: string | null }> {
  try {
    const j = await getJson<{ date: string; rates: { EUR: number } }>(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR"
    );
    if (typeof j.rates?.EUR === "number") return { rate: j.rates.EUR, date: j.date };
  } catch {
    // fall through to the fixed rate
  }
  return { rate: FALLBACK_USD_TO_EUR, date: null };
}

async function build(): Promise<PricesResponse> {
  const [{ cards }, groupsRes, fx, MAP, finishData] = await Promise.all([
    getCardsAndSets(),
    getJson<{ results: Group[] }>(`${TCGCSV}/groups`),
    getRate(),
    getCardmarketMap(),
    getFinishData(),
  ]);
  setFinishData(finishData);

  const idByCode = new Map(cards.map((c) => [c.publicCode, c.id]));
  const setIds = new Set(cards.map((c) => c.set.id));
  const groups = groupsRes.results.filter((g) => setIds.has(g.abbreviation));
  const euro = (usd: number) => Math.round(usd * fx.rate * 100) / 100;
  const prices: Record<string, CardPrices> = {};

  await Promise.all(
    groups.map(async (group) => {
      const [products, rows] = await Promise.all([
        getJson<{ results: Product[] }>(`${TCGCSV}/${group.groupId}/products`),
        getJson<{ results: PriceRow[] }>(`${TCGCSV}/${group.groupId}/prices`),
      ]);
      const rowsOf = new Map<number, PriceRow[]>();
      for (const row of rows.results) rowsOf.set(row.productId, [...(rowsOf.get(row.productId) ?? []), row]);

      for (const product of products.results) {
        const number = product.extendedData?.find((e) => e.name === "Number")?.value;
        const id = number ? idByCode.get(`${group.abbreviation}-${number}`) : undefined;
        if (!id) continue;
        for (const row of rowsOf.get(product.productId) ?? []) {
          const usd = row.marketPrice ?? row.midPrice ?? row.lowPrice;
          if (usd === null || usd === undefined) continue;
          const finish = row.subTypeName === "Foil" ? "foil" : row.subTypeName === "Normal" ? "normal" : null;
          if (!finish) continue;
          (prices[id] ??= {})[finish] = { price: euro(usd), low: row.lowPrice === null ? null : euro(row.lowPrice) };
        }
      }
    })
  );

  // Overlay Cardmarket's prices where we can link the card to a product.
  let fromCardmarket = 0;
  try {
    const guide = new Map(
      (await getJson<{ priceGuides: Guide[] }>(CARDMARKET)).priceGuides.map((g) => [g.idProduct, g] as const)
    );
    for (const card of cards) {
      const g = guide.get(MAP[card.id]);
      if (!g) continue;
      const available = availableFinishes(card);
      for (const finish of ["normal", "foil"] as const) {
        if (!available[finish]) continue;
        const cm = cardmarketPrice(g, finish);
        if (!cm) continue;
        const tcg = prices[card.id]?.[finish]?.price;
        // A pairing mistake would show up as wildly different prices - trust TCGplayer then.
        if (tcg !== undefined && (cm.price > tcg * 5 || cm.price < tcg * 0.2)) continue;
        (prices[card.id] ??= {})[finish] = { ...cm, source: "cardmarket" };
        fromCardmarket++;
      }
    }
  } catch {
    // Cardmarket unreachable: TCGplayer prices stand on their own.
  }

  return { updatedAt: new Date().toISOString(), usdToEur: fx.rate, rateDate: fx.date, prices, fromCardmarket };
}

// Forget the built prices so the next request fetches them again.
export function resetPriceCache() {
  cache = null;
}

// Prices only change daily, so build them at most every few hours and share
// the result (and any build in progress) between requests.
export async function getPrices(): Promise<PricesResponse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  inflight ??= build()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
