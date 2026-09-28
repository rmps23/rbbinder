export type RiftCard = {
  id: string;
  name: string;
  subtitle: string | null;
  publicCode: string;
  collectorNumber: number;
  set: { id: string; name: string };
  types: string[];
  rarity: { id: string; label: string } | null;
  domains: { id: string; label: string }[];
  energy: number | null;
  might: number | null;
  mightBonus: number | null;
  power: number | null;
  tags: string[];
  illustrator: string | null;
  abilityText: string;
  image: { url: string | null; width: number | null; height: number | null; alt: string };
};

export type SetInfo = { id: string; name: string; cardCount: number };

// card_id -> quantity owned
export type QtyMap = Record<string, number>;

// A binder page is a flat grid of slots/pockets. A slot either holds a
// card (+ how many copies sit in that pocket) or is empty. Keyed by a flat
// zero-based position (page = floor(position / perPage)).
export type BinderSlot = { cardId: string; qty: number };
export type BinderSlots = Record<number, BinderSlot>;

export type BinderLayout = "2x2" | "3x3" | "3x4" | "4x4";

export type Binder = {
  id: string;
  name: string;
  layout: BinderLayout;
  sortOrder: number;
  createdAt: string;
  uniqueCount: number;
  totalQty: number;
  // Minimum number of pages the binder always shows, regardless of how much
  // is filled - grows via the "+" button next to the binder pages.
  pageCount: number;
};

export type CardsSyncResult = {
  ok: true;
  totalCards: number;
  totalSets: number;
  newCards: number;
  newSets: string[];
};
