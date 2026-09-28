// Fetches the official English Riftbound card gallery data straight from
// playriftbound.com. Used by POST /api/cards/sync (triggered by the
// "Sincronizar cartas" button on the dashboard) to refresh the cards/sets
// tables in Supabase whenever Riot releases a new set.
//
// Card images are NOT downloaded/rehosted - we only store the official CDN
// URL (cmsassets.rgpub.io) and link to it directly. Card data & images are
// (c) Riot Games.

import type { RiftCard, SetInfo } from "./types";

const GALLERY_URL = "https://playriftbound.com/en-us/card-gallery/";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (RBBinder card fetch)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (RBBinder card fetch)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function getBuildId(): Promise<string> {
  const html = await fetchText(GALLERY_URL);
  const match = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/);
  if (!match) throw new Error("Could not find Next.js buildId on gallery page");
  return match[1];
}

function plainText(richText: { body?: string } | undefined | null): string {
  if (!richText?.body) return "";
  return richText.body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenCard(c: any): RiftCard {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle ?? null,
    publicCode: c.publicCode,
    collectorNumber: c.collectorNumber,
    set: { id: c.set.value.id, name: c.set.value.label },
    types: (c.cardType?.type ?? []).map((t: { id: string }) => t.id),
    rarity: c.rarity ? { id: c.rarity.value.id, label: c.rarity.value.label } : null,
    domains: (c.domain?.values ?? []).map((d: { id: string; label: string }) => ({ id: d.id, label: d.label })),
    energy: c.energy?.value?.id ?? null,
    might: c.might?.value?.id ?? null,
    mightBonus: c.mightBonus?.value?.id ?? null,
    power: c.power?.value?.id ?? null,
    tags: (c.tags?.values ?? []).map((t: { label?: string; id?: string }) => t.label ?? t.id ?? t),
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

export async function fetchRiftboundCatalog(): Promise<{ cards: RiftCard[]; sets: SetInfo[] }> {
  const buildId = await getBuildId();
  const dataUrl = `https://playriftbound.com/_next/data/${buildId}/en-us/card-gallery.json`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await fetchJson(dataUrl)) as any;

  const blades = data?.pageProps?.page?.blades ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gallery = blades.find((b: any) => b.fragmentId === "card-gallery");
  if (!gallery) throw new Error("card-gallery fragment not found in page data");

  const rawCards = gallery.cards?.items ?? [];
  const rawSets = gallery.sets?.items ?? [];
  if (rawCards.length === 0) throw new Error("No cards found - page structure may have changed");

  const cards = rawCards.map(flattenCard).sort((a: RiftCard, b: RiftCard) => {
    if (a.set.id !== b.set.id) return a.set.id.localeCompare(b.set.id);
    return (a.collectorNumber ?? 0) - (b.collectorNumber ?? 0);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets: SetInfo[] = rawSets.map((s: any) => ({
    id: s.id,
    name: s.name,
    cardCount: cards.filter((c: RiftCard) => c.set.id === s.id).length,
  }));

  return { cards, sets };
}
