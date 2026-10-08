"use client";

import { BinderSlotTile } from "@/components/BinderSlotTile";
import { GRID_COLS_CLASS } from "@/lib/constants";
import type { RiftCard } from "@/lib/types";

export type SlotView = { position: number; card: RiftCard | null; qty: number };

// Phone-only behaviour: taps open card details / pick a slot instead of
// hover + drag-and-drop.
export type TouchMode = {
  selected: number | null;
  moveActive: boolean;
  onTap: (position: number) => void;
};

export type PageGridProps = {
  slots: SlotView[];
  cols: number;
  onPick: (position: number) => void;
  onRemove: (position: number) => void;
  onDropCard: (from: number, to: number) => void;
  onInsertAt: (from: number, insertPosition: number) => void;
  touch?: TouchMode;
  compact?: boolean;
};

export function PageGrid({ slots, cols, onPick, onRemove, onDropCard, onInsertAt, touch, compact }: PageGridProps) {
  const spacing = compact ? (cols >= 4 ? "gap-1.5 p-2" : "gap-2 p-2") : "gap-3 p-3";
  return (
    <div className={`grid ${GRID_COLS_CLASS[cols]} h-full ${spacing}`}>
      {slots.map(({ position, card, qty }) => (
        <BinderSlotTile
          key={position}
          position={position}
          card={card}
          qty={qty}
          onPick={() => (touch ? touch.onTap(position) : onPick(position))}
          onRemove={() => onRemove(position)}
          onDropCard={onDropCard}
          onInsertAt={onInsertAt}
          onOpen={touch ? () => touch.onTap(position) : undefined}
          selected={touch?.selected === position}
          moveActive={touch?.moveActive ?? false}
          compact={compact}
        />
      ))}
    </div>
  );
}

// Paper-like page background: a soft top highlight plus shading toward the
// binder spine (right edge of a left page, left edge of a right page).
export function pageBackground(side: "left" | "right"): string {
  return (
    `linear-gradient(${side === "left" ? 270 : 90}deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 9%, transparent 24%), ` +
    "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.05), transparent 60%), " +
    "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, transparent 30%, rgba(0,0,0,0.16) 100%), " +
    "#1a212c"
  );
}
