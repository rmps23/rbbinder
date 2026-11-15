// Riot's card gallery leaves out most rune printings: none from Spiritforged or
// Unleashed, no alternate-art Vendetta runes and no Organized Play promo runes.
// TCGplayer lists them all (with collector numbers and pictures), so "Sync
// cards" adds the ones Riot is missing from there. It does the same for promo
// printings (event, judge and bundle promos), which Riot's gallery doesn't list.

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

// ---------- promo printings ----------

// TCGplayer groups that only hold promo printings of existing cards (event
// promos, judge cards, bundles). Riot's gallery has none of them. The key is the
// TCGplayer abbreviation; the set id must stay a plain code.
export const PROMO_GROUPS: Record<string, { id: string; name: string }> = {
  OPP: { id: "OPP", name: "Organized Play Promos" },
  PR: { id: "PR", name: "Promotional Cards" },
  JDG: { id: "JDG", name: "Judge Promos" },
  RWB: { id: "RWB", name: "Worlds Bundle 2025" },
  SGN: { id: "SGN", name: "Secret Garden" },
  T12025: { id: "T12025", name: "T1 Worlds Champion Bundles" },
  "RXK/DA": { id: "RXKDA", name: "K/DA Couture Collection" },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

// Every promo printing TCGplayer lists, as its own card: rules text, stats and
// domains come from the regular printing with the same name, the picture and
// code from TCGplayer. Variants of one number (e.g. "Metal (Best Of)" and
// "Metal (Prize Wall)") are separate cards. Runes are left to missingRunes.
export async function missingPromos(cards: RiftCard[]): Promise<{ cards: RiftCard[]; sets: SetInfo[] }> {
  // the regular printing of each card, by "Name, Subtitle" and - for legends,
  // which Riot names by title only - by title
  const byFull = new Map<string, RiftCard>();
  const byTitle = new Map<string, RiftCard>();
  for (const c of cards) {
    if (c.types.includes("rune")) continue;
    const full = norm(c.subtitle ? `${c.name}, ${c.subtitle}` : c.name);
    const prefer = (m: Map<string, RiftCard>, k: string) => {
      const cur = m.get(k);
      if (!cur || (cur.publicCode.length > c.publicCode.length && !/sp|\*/i.test(c.publicCode))) m.set(k, c);
    };
    prefer(byFull, full);
    if (c.types.includes("legend")) prefer(byTitle, norm(c.name));
  }
  const findBase = (productName: string) => {
    const name = norm(productName.replace(/\s*\([^)]*\)/g, ""));
    return byFull.get(name) ?? byTitle.get(name.split(", ").slice(1).join(", ")) ?? byTitle.get(name);
  };

  const groups = (await getJson<{ results: { groupId: number; abbreviation: string }[] }>(`${TCGCSV}/groups`)).results.filter(
    (g) => PROMO_GROUPS[g.abbreviation]
  );
  const known = new Set(cards.map((c) => c.id));
  const added: RiftCard[] = [];
  const counts = new Map<string, number>();

  for (const g of groups) {
    const set = PROMO_GROUPS[g.abbreviation];
    const products = (await getJson<{ results: Product[] }>(`${TCGCSV}/${g.groupId}/products`)).results;
    for (const p of products) {
      const ext = Object.fromEntries((p.extendedData ?? []).map((e) => [e.name, e.value]));
      if (!ext.Number || /rune/i.test(ext["Card Type"] ?? "")) continue;
      const base = findBase(p.name);
      if (!base) continue; // a card Riot hasn't published yet, or a token
      const variant = [...p.name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(", ");
      const code = `${set.id}-${ext.Number.replace(/\s+/g, "")}`;
      let id = slug(variant ? `${code}-${variant}` : code);
      if (known.has(id)) id = `${id}-${p.productId}`;
      if (known.has(id)) continue;
      known.add(id);
      const rarity = (ext.Rarity ?? "Promo").toLowerCase();
      added.push({
        ...base,
        id,
        publicCode: variant ? `${code} (${variant})` : code,
        collectorNumber: Number(ext.Number.match(/(\d+)\s*[a-z*]*\//i)?.[1] ?? 0),
        set: { id: set.id, name: set.name },
        rarity: { id: rarity, label: rarity.charAt(0).toUpperCase() + rarity.slice(1) },
        tcgplayerId: p.productId,
        image: {
          url: p.imageUrl ? p.imageUrl.replace(/_\d+w\.jpg$/, "_in_1000x1000.jpg") : null,
          width: null,
          height: null,
          alt: p.name,
        },
      });
      counts.set(set.id, (counts.get(set.id) ?? 0) + 1);
    }
  }

  const sets: SetInfo[] = [...counts].map(([id, cardCount]) => ({
    id,
    name: Object.values(PROMO_GROUPS).find((s) => s.id === id)!.name,
    cardCount,
  }));
  return { cards: added, sets };
}
