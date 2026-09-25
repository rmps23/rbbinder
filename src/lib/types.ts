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

export type QtyField = "binder" | "bulk";

export type CollectionEntry = { binder: number; bulk: number };

export type CollectionMap = Record<string, CollectionEntry>;
