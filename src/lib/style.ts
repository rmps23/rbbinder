export const RARITY_COLORS: Record<string, string> = {
  common: "#8A8F98",
  uncommon: "#41B4B8",
  rare: "#3D7FE0",
  epic: "#A35DE0",
  showcase: "#D9A441",
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
