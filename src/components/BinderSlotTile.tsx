"use client";

import Image from "next/image";
import { useState } from "react";
import type { RiftCard } from "@/lib/types";

type DropZone = "before" | "after" | "swap";

export function BinderSlotTile({
  position,
  card,
  qty,
  onPick,
  onRemove,
  onDropCard,
  onInsertAt,
  onOpen,
  selected = false,
  moveActive = false,
  compact = false,
}: {
  position: number;
  card: RiftCard | null;
  qty: number;
  onPick: () => void;
  onRemove: () => void;
  onDropCard: (fromPosition: number, toPosition: number) => void;
  onInsertAt: (fromPosition: number, insertPosition: number) => void;
  // Touch mode (phones): tapping a filled slot opens its details instead of
  // relying on hover/drag, which don't exist there.
  onOpen?: () => void;
  selected?: boolean;
  moveActive?: boolean;
  compact?: boolean;
}) {
  const touch = onOpen !== undefined;
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  if (!card) {
    return (
      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setDropZone("swap");
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDropZone(null);
          const from = Number(e.dataTransfer.getData("text/plain"));
          if (!Number.isNaN(from) && from !== position) onDropCard(from, position);
        }}
        className={`flex aspect-[744/1039] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition active:scale-[0.97] ${
          dropZone || moveActive
            ? "border-brand-gold/70 bg-brand-gold/10 text-brand-gold"
            : "border-white/10 bg-ink/40 text-white/15 hover:border-brand-gold/50 hover:text-brand-gold/70"
        }`}
      >
        <span className={`leading-none ${compact ? "text-2xl" : "text-3xl"}`}>+</span>
        <span className="text-[10px] font-medium">{moveActive ? "Move here" : "Add card"}</span>
      </button>
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.25) setDropZone("before");
    else if (relX > 0.75) setDropZone("after");
    else setDropZone("swap");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const zone = dropZone;
    setDropZone(null);
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from) || from === position) return;
    if (zone === "before") onInsertAt(from, position);
    else if (zone === "after") onInsertAt(from, position + 1);
    else onDropCard(from, position);
  }

  // Gives the browser a dimmed, semi-transparent copy of the tile to carry
  // under the cursor instead of its (fairly opaque) default drag image, so
  // you can actually see the slot underneath while dragging.
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", String(position));
    e.dataTransfer.effectAllowed = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const ghost = e.currentTarget.cloneNode(true) as HTMLDivElement;
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = "0.4";
    ghost.style.filter = "brightness(0.35)";
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
    window.setTimeout(() => document.body.removeChild(ghost), 0);
  }

  return (
    <div
      draggable={!touch}
      onDragStart={touch ? undefined : handleDragStart}
      onDragOver={touch ? undefined : handleDragOver}
      onDragLeave={touch ? undefined : () => setDropZone(null)}
      onDrop={touch ? undefined : handleDrop}
      onClick={touch ? onOpen : undefined}
      onKeyDown={
        touch
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      role={touch ? "button" : undefined}
      tabIndex={touch ? 0 : undefined}
      aria-label={touch ? `${card.name}, open details` : undefined}
      className={`group relative aspect-[744/1039] w-full overflow-hidden rounded-lg border border-white/15 bg-[#0a0c10] transition ${
        touch ? "cursor-pointer active:scale-[0.97]" : "cursor-grab active:cursor-grabbing"
      } ${dropZone === "swap" ? "ring-2 ring-brand-gold/60" : ""} ${selected ? "ring-2 ring-brand-cyan" : ""} ${
        moveActive && !selected ? "ring-1 ring-brand-gold/50" : ""
      }`}
    >
      {card.image.url && !imgError ? (
        <Image
          src={card.image.url}
          alt={card.image.alt}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
          loading="eager"
          className={`pointer-events-none object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-white/40">{card.name}</div>
      )}

      {dropZone === "before" && <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand-gold" />}
      {dropZone === "after" && <span className="pointer-events-none absolute inset-y-0 right-0 w-1.5 bg-brand-gold" />}

      <span
        className={`absolute flex items-center justify-center rounded-full bg-ink/80 font-display font-bold text-brand-gold ring-1 ring-white/10 ${
          compact ? "left-1 top-1 h-5 w-5 text-xs" : "left-1.5 top-1.5 h-7 w-7 text-base"
        }`}
      >
        {qty}
      </span>

      {!touch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove card from this slot"
          aria-label="Remove card from this slot"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-red/90 text-white opacity-0 shadow transition hover:bg-brand-red group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7"
            />
          </svg>
        </button>
      )}

      {!touch && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-b from-transparent to-black/90 p-2 pt-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">{card.name}</p>
          <p className="text-[10px] text-white/60">{card.publicCode}</p>
        </div>
      )}
    </div>
  );
}
