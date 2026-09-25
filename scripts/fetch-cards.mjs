// Fetches the official English Riftbound card gallery data from playriftbound.com
// and writes a flattened dataset to public/data/cards.json and public/data/sets.json.
//
// Card images are NOT downloaded/rehosted - we only store the official CDN URL
// (cmsassets.rgpub.io) and link to it directly. Card data & images are (c) Riot Games.
//
// Re-run with: npm run fetch:cards

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "data");
const GALLERY_URL = "https://playriftbound.com/en-us/card-gallery/";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (RBBinder card fetch script)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (RBBinder card fetch script)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function getBuildId() {
  const html = await fetchText(GALLERY_URL);
  const match = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/);
  if (!match) throw new Error("Could not find Next.js buildId on gallery page");
  return match[1];
}

function plainText(richText) {
  if (!richText?.body) return "";
  return richText.body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function flattenCard(c) {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle ?? null,
    publicCode: c.publicCode,
    collectorNumber: c.collectorNumber,
    set: { id: c.set.value.id, name: c.set.value.label },
    types: (c.cardType?.type ?? []).map((t) => t.id),
    rarity: c.rarity ? { id: c.rarity.value.id, label: c.rarity.value.label } : null,
    domains: (c.domain?.values ?? []).map((d) => ({ id: d.id, label: d.label })),
    energy: c.energy?.value?.id ?? null,
    might: c.might?.value?.id ?? null,
    mightBonus: c.mightBonus?.value?.id ?? null,
    power: c.power?.value?.id ?? null,
    tags: (c.tags?.values ?? []).map((t) => t.label ?? t.id ?? t),
    illustrator: c.illustrator?.values?.[0]?.label ?? null,
    abilityText: plainText(c.text?.richText),
    image: {
      url: c.cardImage?.url ?? null,
      width: c.cardImage?.dimensions?.width ?? null,
      height: c.cardImage?.dimensions?.height ?? null,
      alt: c.cardImage?.accessibilityText ?? c.name,
    },
  };
}

async function main() {
  console.log("Resolving current Next.js build id...");
  const buildId = await getBuildId();
  console.log("buildId:", buildId);

  const dataUrl = `https://playriftbound.com/_next/data/${buildId}/en-us/card-gallery.json`;
  console.log("Fetching gallery data:", dataUrl);
  const data = await fetchJson(dataUrl);

  const blades = data?.pageProps?.page?.blades ?? [];
  const gallery = blades.find((b) => b.fragmentId === "card-gallery");
  if (!gallery) throw new Error("card-gallery fragment not found in page data");

  const rawCards = gallery.cards?.items ?? [];
  const rawSets = gallery.sets?.items ?? [];
  if (rawCards.length === 0) throw new Error("No cards found - page structure may have changed");

  const cards = rawCards.map(flattenCard).sort((a, b) => {
    if (a.set.id !== b.set.id) return a.set.id.localeCompare(b.set.id);
    return (a.collectorNumber ?? 0) - (b.collectorNumber ?? 0);
  });

  const sets = rawSets.map((s) => ({
    id: s.id,
    name: s.name,
    cardCount: cards.filter((c) => c.set.id === s.id).length,
  }));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "cards.json"), JSON.stringify(cards, null, 2));
  await writeFile(path.join(OUT_DIR, "sets.json"), JSON.stringify(sets, null, 2));
  await writeFile(
    path.join(OUT_DIR, "meta.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), totalCards: cards.length }, null, 2)
  );

  console.log(`Wrote ${cards.length} cards across ${sets.length} sets to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
