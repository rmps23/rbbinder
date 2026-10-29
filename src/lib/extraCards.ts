// Riot's card gallery leaves out most rune printings: none from Spiritforged or
// Unleashed, no alternate-art Vendetta runes and no Organized Play promo runes.
// TCGplayer lists them all (with collector numbers and pictures), so "Sync
// cards" adds the ones Riot is missing from there.

import type { RiftCard, SetInfo } from "./types";

const TCGCSV = "https://tcgcsv.com/tcgplayer/89"; // 89 = Riftbound
const HEADERS = { "user-agent": "RBBinder/1.0 (personal Riftbound collection app)" };
const PROMO_SET = { id: "OPP", name: "Organized Play Promos" };

type Product = { productId: number; name: string; imageUrl?: string; extendedData?: { name: string; value: string }[] };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function missingRunes(cards: RiftCard[], sets: SetInfo[]): Promise<{ cards: RiftCard[]; sets: SetInfo[] }> {
  const codes = new Set(cards.map((c) => c.publicCode));
  const setName = new Map(sets.map((s) => [s.id, s.name]));
  const groups = (await getJson<{ results: { groupId: number; abbreviation: string }[] }>(`${TCGCSV}/groups`)).results.filter(
    (g) => setName.has(g.abbreviation) || g.abbreviation === PROMO_SET.id
  );

  const added: RiftCard[] = [];
  for (const g of groups) {
    const products = (await getJson<{ results: Product[] }>(`${TCGCSV}/${g.groupId}/products`)).results;
    for (const p of products) {
      const ext = Object.fromEntries((p.extendedData ?? []).map((e) => [e.name, e.value]));
      if (ext["Card Type"] !== "Rune" || !ext.Number) continue;
      const code = `${g.abbreviation}-${ext.Number}`;
      if (codes.has(code)) continue;
      codes.add(code);
      const domain = (ext.Domain ?? "").toLowerCase();
      const rarity = (ext.Rarity ?? "Common").toLowerCase();
      const name = p.name.replace(/\s*\([^)]*\)\s*$/, "");
      added.push({
        id: code.toLowerCase().replace(/\//g, "-"),
        name,
        subtitle: null,
        publicCode: code,
        collectorNumber: Number(ext.Number.match(/\d+/)?.[0] ?? 0),
        set: { id: g.abbreviation, name: setName.get(g.abbreviation) ?? PROMO_SET.name },
        types: ["rune"],
        superTypes: ["basic"],
        rarity: { id: rarity, label: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
        domains: domain ? [{ id: domain, label: ext.Domain }] : [],
        energy: null,
        might: null,
        mightBonus: null,
        power: null,
        tags: [],
        illustrator: null,
        abilityText: "",
        image: {
          url: p.imageUrl ? p.imageUrl.replace(/_\d+w\.jpg$/, "_in_1000x1000.jpg") : null,
          width: null,
          height: null,
          alt: name,
        },
      });
    }
  }

  const newSets: SetInfo[] = [];
  const promos = added.filter((c) => c.set.id === PROMO_SET.id).length;
  if (promos && !setName.has(PROMO_SET.id)) newSets.push({ ...PROMO_SET, cardCount: promos });
  return { cards: added, sets: newSets };
}
