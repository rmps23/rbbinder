"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { ScanCardModal } from "@/components/ScanCardModal";
import type { Finish } from "@/lib/cardFinish";
import type { RiftCard } from "@/lib/types";

// Proving Grounds isn't tracked for bulk/trades (same as the card browser).
const EXCLUDED_SETS = new Set(["OGS"]);

export function BulkScanner() {
  const { cards, bulk, setBulkQty, priceOf } = useAppData();
  const [open, setOpen] = useState(false);
  // Stable identity: the scanner restarts the camera if this array changes.
  const scanCards = useMemo(() => cards.filter((c) => !EXCLUDED_SETS.has(c.set.id)), [cards]);

  function addCopy(card: RiftCard, finish: Finish) {
    setBulkQty(card.id, finish, (bulk[card.id]?.[finish] ?? 0) + 1);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-brand-gold px-4 font-display text-xs font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft active:bg-brand-goldSoft"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
          />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
        Scan cards
      </button>
      {open && (
        <ScanCardModal cards={scanCards} bulk={{ counts: bulk, onAdd: addCopy, priceOf }} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
