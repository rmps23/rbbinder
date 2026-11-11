"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CardDetailModal } from "@/components/CardDetailModal";
import type { RiftCard } from "@/lib/types";

// One card modal for the whole app: anywhere a card is shown, `inspect(card)`
// opens the same view the binders use.
const CardInspectContext = createContext<(card: RiftCard) => void>(() => {});

export function CardInspectProvider({ children }: { children: React.ReactNode }) {
  const [card, setCard] = useState<RiftCard | null>(null);
  const close = useCallback(() => setCard(null), []);
  const inspect = useMemo(() => (c: RiftCard) => setCard(c), []);
  return (
    <CardInspectContext.Provider value={inspect}>
      {children}
      {card && <CardDetailModal card={card} onClose={close} />}
    </CardInspectContext.Provider>
  );
}

export const useCardInspect = () => useContext(CardInspectContext);
