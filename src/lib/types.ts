export type RiftCard = {
  id: string;
  name: string;
  subtitle: string | null;
  publicCode: string;
  collectorNumber: number;
  set: { id: string; name: string };
  types: string[];
  // champion / signature / token / basic. Missing on cards synced before this existed.
  superTypes?: string[];
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

// Prices are English-market (TCGplayer) averages, already converted to euros.
export type PriceEntry = { price: number; low: number | null };
export type CardPrices = { normal?: PriceEntry; foil?: PriceEntry };
export type PricesResponse = {
  updatedAt: string;
  usdToEur: number;
  rateDate: string | null;
  prices: Record<string, CardPrices>;
};

// card_id -> how many normal/foil copies are in the bulk pile
export type BulkVariant = "normal" | "foil";
export type BulkEntry = { normal: number; foil: number };
export type BulkMap = Record<string, BulkEntry>;

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
  // card id -> copies placed (only from the binders list; used to value each binder)
  contents?: Record<string, number>;
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

// ---------- decks ----------

export type DeckZone = "legend" | "champion" | "main" | "battlefield" | "rune" | "sideboard";
// One printing of a card in one zone of a deck. Which printing is just for the
// picture - owning any printing (by name) counts as having the card.
export type DeckEntry = { cardId: string; zone: DeckZone; qty: number };
export type Deck = {
  id: string;
  name: string;
  entries: DeckEntry[];
  createdAt: string;
  updatedAt: string;
};
