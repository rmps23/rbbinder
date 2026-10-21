// The jobs behind the buttons on the Maintenance page. They used to be scripts
// run by hand; they live here so they work on the deployed site too (results are
// stored in the database, see appData.ts).

import { setAppData } from "./appData";
import { setFinishData, type FinishData } from "./cardFinish";
import { getCardsAndSets } from "./repo";
import { fetchRiftboundCatalog } from "./riftboundCatalog";
import { resetPriceCache } from "./tcgPrices";
import type { RiftCard } from "./types";

const HEADERS = { "user-agent": "Mozilla/5.0 (RBBinder maintenance)" };
const TCGCSV = "https://tcgcsv.com/tcgplayer/89"; // 89 = Riftbound
const CARDMARKET = "https://downloads.s3.cardmarket.com/productCatalog";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- TCGplayer (through TCGCSV), matched by printed collector number ----------

type TcgInfo = { released: boolean; finishes: Set<"normal" | "foil">; usd: number | null; domain: string | null };

async function loadTcg(cards: Pick<RiftCard, "id" | "publicCode" | "set">[]): Promise<Map<string, TcgInfo>> {
  const byCode = new Map(cards.map((c) => [c.publicCode, c.id]));
  const setIds = new Set(cards.map((c) => c.set.id));
  const groups = (await getJson<{ results: { groupId: number; abbreviation: string; publishedOn: string }[] }>(`${TCGCSV}/groups`)).results.filter(
    (g) => setIds.has(g.abbreviation)
  );
  const out = new Map<string, TcgInfo>();

  await Promise.all(
    groups.map(async (g) => {
      const [products, prices] = await Promise.all([
        getJson<{ results: { productId: number; extendedData?: { name: string; value: string }[] }[] }>(`${TCGCSV}/${g.groupId}/products`),
        getJson<{
          results: { productId: number; subTypeName: string; marketPrice: number | null; midPrice: number | null; lowPrice: number | null }[];
        }>(`${TCGCSV}/${g.groupId}/prices`),
      ]);
      const released = new Date(g.publishedOn) <= new Date();
      const rows = new Map<number, typeof prices.results>();
      for (const r of prices.results) rows.set(r.productId, [...(rows.get(r.productId) ?? []), r]);

      for (const p of products.results) {
        const ext = Object.fromEntries((p.extendedData ?? []).map((e) => [e.name, e.value]));
        const id = ext.Number ? byCode.get(`${g.abbreviation}-${ext.Number}`) : undefined;
        if (!id) continue;
        const finishes = new Set<"normal" | "foil">();
        let usd: number | null = null;
        for (const r of rows.get(p.productId) ?? []) {
          if (r.subTypeName === "Foil") finishes.add("foil");
          else if (r.subTypeName === "Normal") finishes.add("normal");
          const v = r.marketPrice ?? r.midPrice ?? r.lowPrice;
          if (v !== null && v !== undefined) usd = Math.max(usd ?? 0, v);
        }
        out.set(id, { released, finishes, usd, domain: ext.Domain && ext.Domain !== "None" ? ext.Domain : null });
      }
    })
  );
  return out;
}

// ---------- finish availability (normal / foil) ----------

// The default rules - keep in sync with availableFinishes() in cardFinish.ts.
function ruleFinish(c: Pick<RiftCard, "publicCode" | "rarity">): "foil" | "both" {
  const r = c.rarity?.id;
  return c.publicCode.includes("*") || r === "rare" || r === "epic" || r === "showcase" ? "foil" : "both";
}

export async function updateFinishes() {
  const { cards } = await getCardsAndSets();
  const tcg = await loadTcg(cards);
  const data: FinishData = { generatedAt: new Date().toISOString(), foilOnly: [], normalOnly: [], both: [] };
  let checked = 0;
  for (const card of cards) {
    const info = tcg.get(card.id);
    if (!info || !info.released || info.finishes.size === 0) continue;
    checked++;
    const actual = info.finishes.has("normal") && info.finishes.has("foil") ? "both" : info.finishes.has("foil") ? "foil" : "normal";
    if (actual === ruleFinish(card)) continue;
    (actual === "foil" ? data.foilOnly : actual === "normal" ? data.normalOnly : data.both).push(card.id);
  }
  for (const list of [data.foilOnly, data.normalOnly, data.both]) list.sort();
  await setAppData("finishes", data);
  setFinishData(data);
  resetPriceCache();
  return `Checked ${checked} cards: ${data.foilOnly.length} foil-only, ${data.normalOnly.length} normal-only and ${data.both.length} in both finishes that differ from the default rules.`;
}

// ---------- domains of unreleased sets ----------

export async function updateDomainFixes() {
  // Riot's own data (not the corrected copy the app serves).
  const { cards } = await fetchRiftboundCatalog();
  const tcg = await loadTcg(cards);
  const fixes: Record<string, string[]> = {};
  for (const card of cards) {
    const info = tcg.get(card.id);
    if (!info || info.released || !info.domain) continue;
    const domains = info.domain.split(";").map((d) => d.trim().toLowerCase());
    if (domains.join() !== card.domains.map((d) => d.id).join()) fixes[card.id] = domains;
  }
  await setAppData("domainFixes", fixes);
  return `${Object.keys(fixes).length} cards from unreleased sets have their domains corrected from TCGplayer.`;
}

// ---------- Cardmarket links ----------

// Cardmarket's product list has no collector numbers and variants of a card
// (regular / alt art / signature / reprints) share one name. So within one card
// name, variants are ordered by TCGplayer price and Cardmarket products by their
// own price, and paired in that order. Variants differ a lot in price, so the
// order is reliable; names whose counts don't line up are left unlinked (their
// prices fall back to TCGplayer).
export async function updateCardmarketLinks() {
  const { cards } = await getCardsAndSets();
  const tcg = await loadTcg(cards);

  const [products, guide] = await Promise.all([
    getJson<{ products: { idProduct: number; name: string; idExpansion: number }[] }>(`${CARDMARKET}/productList/products_singles_22.json`),
    getJson<{ priceGuides: Record<string, number | null>[] }>(`${CARDMARKET}/priceGuide/price_guide_22.json`),
  ]);
  const guideOf = new Map(guide.priceGuides.map((g) => [g.idProduct as number, g]));
  const ref = (id: number) => {
    const g = guideOf.get(id) ?? {};
    return Math.max(g["trend-foil"] ?? 0, g.trend ?? 0, g["avg30-foil"] ?? 0, g.avg30 ?? 0, g["low-foil"] ?? 0, g.low ?? 0);
  };
  const cm = products.products.map((p) => ({ id: p.idProduct, key: p.name.toLowerCase(), exp: p.idExpansion, ref: ref(p.idProduct) }));
  const our = cards.map((c) => ({ id: c.id, key: (c.subtitle ? `${c.name}, ${c.subtitle}` : c.name).toLowerCase(), set: c.set.id, usd: tcg.get(c.id)?.usd ?? null }));

  // Which Cardmarket expansion is which of our sets: vote on shared names.
  const count = <T,>(arr: T[], f: (x: T) => string) => arr.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map<string, number>());
  const ourBy = count(our, (c) => `${c.key}|${c.set}`);
  const cmBy = count(cm, (p) => `${p.key}|${p.exp}`);
  const cmByKey = new Map<string, [string, number][]>();
  for (const [ke, m] of cmBy) {
    const [k, exp] = ke.split("|");
    cmByKey.set(k, [...(cmByKey.get(k) ?? []), [exp, m]]);
  }
  const votes = new Map<string, number>();
  for (const [ks, n] of ourBy) {
    const [key, set] = ks.split("|");
    for (const [exp, m] of cmByKey.get(key) ?? []) votes.set(`${set}|${exp}`, (votes.get(`${set}|${exp}`) ?? 0) + Math.min(n, m));
  }
  const expOfSet = new Map<string, string>();
  for (const set of new Set(our.map((c) => c.set))) {
    const best = [...votes].filter(([k]) => k.startsWith(`${set}|`)).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3) expOfSet.set(set, best[0].split("|")[1]);
  }

  const map: Record<string, number> = {};
  const used = new Set<number>();
  const pair = (cs: typeof our, ps: typeof cm) => {
    if (!cs.length || cs.length !== ps.length) return false;
    const a = [...cs].sort((x, y) => (x.usd ?? Infinity) - (y.usd ?? Infinity));
    const b = [...ps].sort((x, y) => x.ref - y.ref);
    a.forEach((c, i) => {
      map[c.id] = b[i].id;
      used.add(b[i].id);
    });
    return true;
  };

  const bySetKey = new Map<string, typeof our>();
  for (const c of our) bySetKey.set(`${c.set}|${c.key}`, [...(bySetKey.get(`${c.set}|${c.key}`) ?? []), c]);
  for (const [sk, cs] of bySetKey) {
    const [set, key] = sk.split("|");
    const exp = expOfSet.get(set);
    if (exp) pair(cs, cm.filter((p) => p.key === key && String(p.exp) === exp));
  }
  // Leftovers (e.g. promos): same name across everything still unlinked.
  const leftByKey = new Map<string, typeof our>();
  for (const c of our.filter((c) => !map[c.id])) leftByKey.set(c.key, [...(leftByKey.get(c.key) ?? []), c]);
  for (const [key, cs] of leftByKey) pair(cs, cm.filter((p) => p.key === key && !used.has(p.id)));

  const linked = Object.keys(map).length;
  await setAppData("cardmarketMap", map);
  resetPriceCache();
  return `Linked ${linked} of ${cards.length} cards (${Math.round((linked / Math.max(1, cards.length)) * 100)}%) to Cardmarket products; the rest use TCGplayer prices.`;
}

// ---------- prices ----------

export async function refreshPrices() {
  resetPriceCache();
  return "Price cache cleared - fresh prices are being fetched.";
}
