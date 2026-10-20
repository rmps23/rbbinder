// English-market prices for every card, in euros.
//
// Source: TCGplayer (an English-language marketplace) through the free public
// TCGCSV mirror, which republishes TCGplayer's product list and prices daily.
// Products are matched to our catalog by their printed collector number
// (e.g. "SFD-223*/221"), which is exact. Prices are in USD, so they're
// converted with the ECB reference rate (frankfurter.dev).
//
// The price shown is TCGplayer's "market price": the average of recent sales
// (falling back to the mid and then the lowest listing when there are none).

import { getCardsAndSets } from "./repo";
import type { CardPrices, PricesResponse } from "./types";

const TCGCSV = "https://tcgcsv.com/tcgplayer/89"; // 89 = Riftbound
const TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_USD_TO_EUR = 0.89;

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
  const [{ cards }, groupsRes, fx] = await Promise.all([
    getCardsAndSets(),
    getJson<{ results: Group[] }>(`${TCGCSV}/groups`),
    getRate(),
  ]);

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

  return { updatedAt: new Date().toISOString(), usdToEur: fx.rate, rateDate: fx.date, prices };
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
