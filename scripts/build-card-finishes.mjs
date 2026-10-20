// Finds where a card's finish differs from the default rules in
// src/lib/cardFinish.ts and writes the exceptions to src/lib/cardFinishes.json.
//
// Source of truth: the English market's own product list (TCGplayer, through
// the free public TCGCSV mirror). TCGplayer has one price row per finish a
// card exists in ("Normal" / "Foil"), so a card with only a "Foil" row only
// exists as foil. Cardmarket's price guide can't be used for this: sellers
// often don't tick "foil" on foil cards, so it shows non-foil sales that
// don't exist.
//
// Sets that haven't been released yet are skipped (their listings are
// incomplete) and fall back to the rules.
// Run: node scripts/build-card-finishes.mjs
import { writeFileSync } from "node:fs";

const HEADERS = { "user-agent": "Mozilla/5.0 (RBBinder card fetch)" };
const TCGCSV = "https://tcgcsv.com/tcgplayer/89"; // 89 = Riftbound

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

// Our catalog: Riot's official gallery.
const html = await (await fetch("https://playriftbound.com/en-us/card-gallery/", { headers: HEADERS })).text();
const buildId = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/)?.[1];
if (!buildId) throw new Error("Could not find the gallery buildId");
const gallery = (await getJson(`https://playriftbound.com/_next/data/${buildId}/en-us/card-gallery.json`)).pageProps.page.blades.find(
  (b) => b.fragmentId === "card-gallery"
);
const cards = gallery.cards.items.map((c) => ({
  id: c.id,
  name: c.name,
  subtitle: c.subtitle ?? null,
  code: c.publicCode,
  set: c.set.value.id,
  rarity: c.rarity?.value?.id ?? null,
}));
const byCode = new Map(cards.map((c) => [c.code, c]));

// The default rules - keep in sync with availableFinishes() in src/lib/cardFinish.ts.
function ruleFinish(c) {
  if (c.code.includes("*")) return "foil";
  if (c.rarity === "rare" || c.rarity === "epic" || c.rarity === "showcase") return "foil";
  return "both";
}

const setIds = new Set(cards.map((c) => c.set));
const groups = (await getJson(`${TCGCSV}/groups`)).results.filter((g) => setIds.has(g.abbreviation));

const overrides = { foilOnly: [], normalOnly: [], both: [] };
const examples = { foilOnly: [], normalOnly: [], both: [] };
let checked = 0;

for (const group of groups) {
  if (new Date(group.publishedOn) > new Date()) {
    console.log(`skipping ${group.abbreviation}: not released yet (${group.publishedOn.slice(0, 10)})`);
    continue;
  }
  const [products, prices] = await Promise.all([
    getJson(`${TCGCSV}/${group.groupId}/products`),
    getJson(`${TCGCSV}/${group.groupId}/prices`),
  ]);
  const subsOf = new Map();
  for (const row of prices.results) subsOf.set(row.productId, new Set([...(subsOf.get(row.productId) ?? []), row.subTypeName]));

  for (const product of products.results) {
    const number = product.extendedData?.find((e) => e.name === "Number")?.value;
    const card = number && byCode.get(`${group.abbreviation}-${number}`);
    const subs = subsOf.get(product.productId);
    if (!card || !subs?.size) continue;
    checked++;
    const actual = subs.has("Normal") && subs.has("Foil") ? "both" : subs.has("Foil") ? "foil" : "normal";
    const expected = ruleFinish(card);
    if (actual === expected) continue;
    const list = actual === "foil" ? "foilOnly" : actual === "normal" ? "normalOnly" : "both";
    overrides[list].push(card.id);
    examples[list].push(`${card.code} ${card.subtitle ? `${card.name}, ${card.subtitle}` : card.name}`);
  }
}

for (const list of Object.values(overrides)) list.sort();
writeFileSync(
  new URL("../src/lib/cardFinishes.json", import.meta.url),
  JSON.stringify({ generatedAt: new Date().toISOString(), ...overrides }, null, 1) + "\n"
);

console.log(`checked ${checked} cards against TCGplayer`);
for (const [list, ids] of Object.entries(overrides)) {
  console.log(`\n${list}: ${ids.length} exceptions to the rules`);
  console.log("  " + examples[list].slice(0, 14).join("\n  "));
}
