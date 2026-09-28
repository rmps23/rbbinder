export const TYPE_OPTIONS = [
  { id: "unit", label: "Unit" },
  { id: "spell", label: "Spell" },
  { id: "gear", label: "Gear" },
  { id: "legend", label: "Legend" },
  { id: "battlefield", label: "Battlefield" },
  { id: "rune", label: "Rune" },
];

export const RARITY_OPTIONS = [
  { id: "common", label: "Common" },
  { id: "uncommon", label: "Uncommon" },
  { id: "rare", label: "Rare" },
  { id: "epic", label: "Epic" },
  { id: "showcase", label: "Showcase" },
];

export const DOMAIN_OPTIONS = [
  { id: "fury", label: "Fury" },
  { id: "calm", label: "Calm" },
  { id: "mind", label: "Mind" },
  { id: "body", label: "Body" },
  { id: "chaos", label: "Chaos" },
  { id: "order", label: "Order" },
  { id: "colorless", label: "Colorless" },
];

export const PAGE_SIZE = 60;

export const BINDER_LAYOUTS: { id: "2x2" | "3x3" | "3x4" | "4x4"; label: string; cols: number; rows: number }[] = [
  { id: "2x2", label: "2 × 2", cols: 2, rows: 2 },
  { id: "3x3", label: "3 × 3", cols: 3, rows: 3 },
  { id: "3x4", label: "3 × 4", cols: 3, rows: 4 },
  { id: "4x4", label: "4 × 4", cols: 4, rows: 4 },
];

// Literal class names so Tailwind's content scanner picks them up
// (dynamic template strings like `grid-cols-${n}` are not detected).
export const GRID_COLS_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};
