export const RARITY_COLORS: Record<string, string> = {
  common: "#8b93a3",
  uncommon: "#0ac8b9",
  rare: "#3d7fe0",
  epic: "#a35de0",
  showcase: "#d8ab52",
};

export const DOMAIN_COLORS: Record<string, string> = {
  fury: "#C0392B",
  calm: "#3F8F4F",
  mind: "#2E7FB8",
  body: "#B8862E",
  chaos: "#8E44AD",
  order: "#D4AF37",
  colorless: "#7A7A7A",
};

export function rarityColor(id: string | undefined | null): string {
  return (id && RARITY_COLORS[id]) || "#8A8F98";
}

export function domainColor(id: string | undefined | null): string {
  return (id && DOMAIN_COLORS[id]) || "#7A7A7A";
}

export function titleCase(s: string): string {
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

// A colour per set, taken from the real booster boxes: Origins navy, Spiritforged cream, Unleashed violet,
// Vendetta crimson-pink, Radiance sky blue. Lifted a little so they read on the dark UI.
export const SET_COLORS: Record<string, string> = {
  OGN: "#4A78D6",
  SFD: "#E8D9BF",
  UNL: "#A44FE6",
  VEN: "#E8386F",
  RAD: "#6EC6F2",
};
export function setColor(id: string | undefined | null): string {
  return (id && SET_COLORS[id]) || "#AAAAB0";
}

// Release order of the sets. Sets that aren't listed yet (new releases) come after the known ones, and anything
// that isn't a booster set (Specials, promos, no set at all) always goes last.
export const SET_ORDER = ["OGN", "SFD", "UNL", "VEN", "RAD"];
export function setRank(id: string | undefined | null): number {
  if (!id) return 10_000;
  const i = SET_ORDER.indexOf(id);
  return i >= 0 ? i : 1_000;
}
