import type { RiftCard } from "./types";

export type SortKey = "name" | "energy" | "power" | "might" | "type" | "domain" | "rarity" | "set" | "owned";
export type SortDir = "asc" | "desc";

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "energy", label: "Energy" },
  { id: "power", label: "Power" },
  { id: "might", label: "Might" },
  { id: "type", label: "Type" },
  { id: "domain", label: "Domain" },
  { id: "rarity", label: "Rarity" },
  { id: "set", label: "Set" },
  { id: "owned", label: "Owned" },
];

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "showcase"];
const TYPE_ORDER = ["legend", "unit", "spell", "gear", "battlefield", "rune"];

// Context the sort needs beyond the card itself.
export type SortCtx = {
  owned: (card: RiftCard) => number; // copies you own (bulk + binders)
  setOrder: (card: RiftCard) => number; // position of the card's set (release order)
};

const rank = (list: string[], id: string | undefined) => {
  const i = id ? list.indexOf(id) : -1;
  return i < 0 ? list.length : i;
};

// A comparable value per key. `null` (card has no energy/power/might) always sorts last.
function valueOf(card: RiftCard, key: SortKey, ctx: SortCtx): number | string | null {
  switch (key) {
    case "name":
      return card.name.toLowerCase();
    case "energy":
      return card.energy;
    case "power":
      return card.power;
    case "might":
      return card.might === null ? null : card.might + (card.mightBonus ?? 0);
    case "type":
      return rank(TYPE_ORDER, card.types[0]);
    case "domain":
      return card.domains.map((d) => d.label).join(" ").toLowerCase() || "~";
    case "rarity":
      return rank(RARITY_ORDER, card.rarity?.id);
    case "set":
      return ctx.setOrder(card);
    case "owned":
      return ctx.owned(card);
  }
}

export function sortCards(cards: RiftCard[], key: SortKey, dir: SortDir, ctx: SortCtx): RiftCard[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => {
    const va = valueOf(a, key, ctx);
    const vb = valueOf(b, key, ctx);
    if (va !== vb) {
      if (va === null) return 1; // missing values stay at the bottom either way
      if (vb === null) return -1;
      const c = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
      if (c !== 0) return c * sign;
    }
    // ties: cheaper first, then by name
    return (a.energy ?? 0) - (b.energy ?? 0) || a.name.localeCompare(b.name);
  });
}
