// Riot's gallery data for sets that aren't out yet (Radiance) has placeholder
// domains - ~25 cards are wrong or blank. TCGplayer's product list (through the
// free TCGCSV mirror) has them right, so for unreleased sets we take the domain
// from there. Writes src/lib/cardDomainFixes.json (card id -> domain ids).
// Re-run it when new sets are announced; delete the set's entries once it's
// released and Riot's data is final.
// Run: node scripts/build-domain-fixes.mjs
import { writeFileSync } from "node:fs";

const HEADERS = { "user-agent": "Mozilla/5.0 (RBBinder card fetch)" };
const TCGCSV = "https://tcgcsv.com/tcgplayer/89";
const getJson = async (url) => {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
};

const html = await (await fetch("https://playriftbound.com/en-us/card-gallery/", { headers: HEADERS })).text();
const buildId = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/)?.[1];
const gallery = (await getJson(`https://playriftbound.com/_next/data/${buildId}/en-us/card-gallery.json`)).pageProps.page.blades.find(
  (b) => b.fragmentId === "card-gallery"
);
const byCode = new Map(gallery.cards.items.map((c) => [c.publicCode, c]));
const setIds = new Set(gallery.cards.items.map((c) => c.set.value.id));

const fixes = {};
for (const group of (await getJson(`${TCGCSV}/groups`)).results) {
  if (!setIds.has(group.abbreviation) || new Date(group.publishedOn) <= new Date()) continue;
  for (const p of (await getJson(`${TCGCSV}/${group.groupId}/products`)).results) {
    const ext = Object.fromEntries((p.extendedData ?? []).map((e) => [e.name, e.value]));
    const card = ext.Number && byCode.get(`${group.abbreviation}-${ext.Number}`);
    if (!card || !ext.Domain || ext.Domain === "None") continue;
    const tcg = ext.Domain.split(";").map((d) => d.trim().toLowerCase());
    const riot = (card.domain?.values ?? []).map((d) => d.id);
    if (tcg.join() !== riot.join()) fixes[card.id] = tcg;
  }
}
writeFileSync(new URL("../src/lib/cardDomainFixes.json", import.meta.url), JSON.stringify(fixes, null, 1) + "\n");
console.log(`${Object.keys(fixes).length} domain fixes written`);
