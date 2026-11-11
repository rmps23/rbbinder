import type { RiftCard } from "./types";

// Alternate-art printings share the same collector number as their base
// card but with a letter suffix (e.g. "OGN-007a/298" vs "OGN-007/298").
const ALT_ART_CODE = /-\d+[a-zA-Z]+\//;

export function isAlternateArt(card: RiftCard): boolean {
  return ALT_ART_CODE.test(card.publicCode);
}

// Battlefields are printed sideways (1039x744); every other card is upright (744x1039).
export function isLandscape(card: Pick<RiftCard, "types">): boolean {
  return card.types.includes("battlefield");
}
