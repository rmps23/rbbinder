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

export type BinderLayout = "2x2" | "3x3" | "3x4" | "4x4";

export type Binder = {
  id: string;
  name: string;
  layout: BinderLayout;
  sortOrder: number;
  createdAt: string;
  uniqueCount: number;
  totalQty: number;
};

export type CardsSyncResult = {
  ok: true;
  totalCards: number;
  totalSets: number;
  newCards: number;
  newSets: string[];
};
