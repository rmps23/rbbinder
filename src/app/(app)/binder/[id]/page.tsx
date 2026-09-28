"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { useBinderCards } from "@/lib/useBinderCards";
import { BinderSlotTile } from "@/components/BinderSlotTile";
import { AddCardModal } from "@/components/AddCardModal";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { FilterState } from "@/components/Filters";
import { BINDER_LAYOUTS, GRID_COLS_CLASS } from "@/lib/constants";
import type { Binder, BinderLayout, BinderSlots, RiftCard } from "@/lib/types";

type SlotView = { position: number; card: RiftCard | null; qty: number };
type FlipState = { side: "left" | "right"; phase: "closing" | "opening" } | null;

const FLIP_MS = 220;

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  altArt: "all",
  onlyOwned: false,
};

function BinderPage({
  slots,
  cols,
  holes,
  onPick,
  onRemove,
  onDropCard,
  onInsertAt,
  style,
}: {
  slots: SlotView[];
  cols: number;
  holes: "left" | "right";
  onPick: (position: number) => void;
  onRemove: (position: number) => void;
  onDropCard: (from: number, to: number) => void;
  onInsertAt: (from: number, insertPosition: number) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className="relative flex-1 rounded-lg bg-[#101319] p-3 shadow-inner" style={style}>
      <div
        className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 flex-col gap-3 ${
          holes === "left" ? "right-1" : "left-1"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-black/50 ring-1 ring-white/5" />
        ))}
      </div>
      <div className={`grid ${GRID_COLS_CLASS[cols]} gap-3`}>
        {slots.map(({ position, card, qty }) => (
          <BinderSlotTile
            key={position}
            position={position}
            card={card}
            qty={qty}
            onPick={() => onPick(position)}
            onRemove={() => onRemove(position)}
            onDropCard={onDropCard}
            onInsertAt={onInsertAt}
          />
        ))}
      </div>
    </div>
  );
}

export default function BinderDetailPage() {
  const params = useParams<{ id: string }>();
  const binderId = params.id;
  const router = useRouter();
  const { cards, sets, loading: cardsLoading } = useAppData();
  const { slots, loading: slotsLoading, placeCard, clearSlot, swapSlots, insertAtBoundary } = useBinderCards(binderId);

  const [binder, setBinder] = useState<Binder | null>(null);
  const [binderLoading, setBinderLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [spread, setSpread] = useState(0);
  const [flip, setFlip] = useState<FlipState>(null);
  const [pickerPosition, setPickerPosition] = useState<number | null>(null);
  const [spineDragOver, setSpineDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Remembers the last filters used in the "add card" popup for this
  // specific binder, so re-opening it doesn't lose your search/set/type.
  const filtersKey = `rbbinder:addFilters:${binderId}`;
  const [addFilters, setAddFilters] = useState<FilterState>(DEFAULT_FILTERS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(filtersKey);
      if (raw) setAddFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
    } catch {
      // localStorage unavailable - just fall back to defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);
  useEffect(() => {
    try {
      localStorage.setItem(filtersKey, JSON.stringify(addFilters));
    } catch {
      // best-effort only
    }
  }, [filtersKey, addFilters]);

  useEffect(() => {
    let cancelled = false;
    setBinderLoading(true);
    fetch(`/api/binders/${binderId}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setBinderLoading(false);
        return;
      }
      const data = await res.json();
      setBinder(data);
      setNameDraft(data.name);
      setBinderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [binderId]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const binderStats = useMemo(() => {
    const cardIds = new Set<string>();
    let totalQty = 0;
    for (const slot of Object.values(slots)) {
      if (slot.qty <= 0) continue;
      cardIds.add(slot.cardId);
      totalQty += slot.qty;
    }
    return { uniqueCount: cardIds.size, totalQty };
  }, [slots]);

  const layout = BINDER_LAYOUTS.find((l) => l.id === binder?.layout) ?? BINDER_LAYOUTS[1];
  const perPage = layout.cols * layout.rows;

  const highestPosition = useMemo(() => {
    const positions = Object.keys(slots).map(Number);
    return positions.length ? Math.max(...positions) : -1;
  }, [slots]);

  // At least binder.pageCount pages, but always one blank page past the
  // last filled one too, like turning to the next empty page of an album.
  const minPagesAllowed = Math.floor(highestPosition / perPage) + 2;
  const totalPages = Math.max(binder?.pageCount ?? 2, minPagesAllowed);
  const canRemovePage = totalPages > minPagesAllowed;
  const totalSpreads = Math.ceil(totalPages / 2);
  const clampedSpread = Math.min(spread, totalSpreads - 1);
  const leftPageIndex = clampedSpread * 2;
  const rightPageIndex = leftPageIndex + 1;
  const insertPosition = rightPageIndex * perPage;

  function buildPageSlots(pageIndex: number): SlotView[] {
    return Array.from({ length: perPage }, (_, i) => {
      const position = pageIndex * perPage + i;
      const slot = slots[position];
      const card = slot ? cardById.get(slot.cardId) ?? null : null;
      return { position, card, qty: slot?.qty ?? 0 };
    });
  }

  const leftSlots = useMemo(() => buildPageSlots(leftPageIndex), [leftPageIndex, perPage, slots, cardById]);
  const rightSlots = useMemo(() => buildPageSlots(rightPageIndex), [rightPageIndex, perPage, slots, cardById]);

  async function changeLayout(newLayout: BinderLayout) {
    setBinder((b) => (b ? { ...b, layout: newLayout } : b));
    setSpread(0);
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: newLayout }),
    });
  }

  async function addPage() {
    const newPageCount = totalPages + 1;
    setBinder((b) => (b ? { ...b, pageCount: newPageCount } : b));
    setSpread(Math.ceil(newPageCount / 2) - 1);
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageCount: newPageCount }),
    });
  }

  async function removePage() {
    if (!canRemovePage) return;
    const newPageCount = totalPages - 1;
    setBinder((b) => (b ? { ...b, pageCount: newPageCount } : b));
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageCount: newPageCount }),
    });
  }

  // Flips the visible spread like a real page turn: the outgoing page
  // rotates edge-on (hiding its content via backface-visibility), the
  // spread swaps underneath while it's invisible, then it rotates back
  // open showing the new pages.
  function turnTo(target: number, side: "left" | "right") {
    if (flip || target === clampedSpread || target < 0 || target > totalSpreads - 1) return;
    setFlip({ side, phase: "closing" });
    window.setTimeout(() => {
      setSpread(target);
      setFlip({ side, phase: "opening" });
      window.setTimeout(() => setFlip(null), FLIP_MS);
    }, FLIP_MS);
  }

  function goPrev() {
    turnTo(clampedSpread - 1, "left");
  }

  function goNext() {
    turnTo(clampedSpread + 1, "right");
  }

  async function saveName() {
    const name = nameDraft.trim();
    setRenaming(false);
    if (!name || name === binder?.name) {
      setNameDraft(binder?.name ?? "");
      return;
    }
    setBinder((b) => (b ? { ...b, name } : b));
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteBinder() {
    if (!binder) return;
    if (!confirm(`Delete binder "${binder.name}"? This action cannot be undone.`)) return;
    await fetch(`/api/binders/${binderId}`, { method: "DELETE" });
    router.push("/");
  }

  function handleDropOnSpine(e: React.DragEvent) {
    e.preventDefault();
    setSpineDragOver(false);
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(from)) insertAtBoundary(from, insertPosition);
  }

  // Places the queued cards (built up in the popup) one after another,
  // starting at the slot that was clicked to open it, skipping over
  // whatever's already filled - including slots filled earlier in this
  // same batch, before React state has had a chance to update.
  function commitQueue(queue: RiftCard[]) {
    if (pickerPosition === null) return;
    let pos = pickerPosition;
    const reserved = new Set<number>();
    for (const card of queue) {
      while ((slots[pos] && slots[pos].qty > 0) || reserved.has(pos)) pos++;
      placeCard(pos, card.id);
      reserved.add(pos);
      pos++;
    }
    setPickerPosition(null);
  }

  if (cardsLoading || binderLoading || slotsLoading) {
    return <p className="py-10 text-center text-white/40">Loading binder...</p>;
  }

  if (notFound || !binder) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-white/40">Binder not found.</p>
        <Link href="/" className="text-sm font-medium text-amber-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setNameDraft(binder.name);
                setRenaming(false);
              }
            }}
            className="rounded-md border border-amber-400/50 bg-[#14171f] px-2 py-1 text-2xl font-bold text-white outline-none"
          />
        ) : (
          <h1
            onClick={() => setRenaming(true)}
            title="Click to rename"
            className="cursor-text text-2xl font-bold text-white hover:text-amber-300"
          >
            {binder.name}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <LayoutSwitcher value={binder.layout} onChange={changeLayout} />
          <button
            onClick={deleteBinder}
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/20"
          >
            Delete binder
          </button>
        </div>
      </div>
      <p className="mb-5 text-sm text-white/50">
        {binderStats.uniqueCount} unique cards · {binderStats.totalQty} copies in this binder. Drag a card onto
        another to swap them, or onto its left/right edge (or into the middle of the pages) to insert it there and
        push the rest along.
      </p>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={clampedSpread === 0 || flip !== null}
          aria-label="Previous pages"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-sm text-white/50">
          Pages {leftPageIndex + 1}–{rightPageIndex + 1} of {totalPages}
        </span>
        <button
          onClick={goNext}
          disabled={clampedSpread >= totalSpreads - 1 || flip !== null}
          aria-label="Next pages"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex-1 rounded-xl border border-white/10 bg-[#07080b] p-2 shadow-2xl sm:p-4"
          style={{ perspective: "2000px" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <BinderPage
              slots={leftSlots}
              cols={layout.cols}
              holes="left"
              onPick={setPickerPosition}
              onRemove={clearSlot}
              onDropCard={swapSlots}
              onInsertAt={insertAtBoundary}
              style={
                flip?.side === "left"
                  ? {
                      transform: `rotateY(${flip.phase === "closing" ? "-130deg" : "0deg"})`,
                      transition: `transform ${FLIP_MS}ms ease-in`,
                      transformOrigin: "right center",
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }
                  : undefined
              }
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setSpineDragOver(true);
              }}
              onDragLeave={() => setSpineDragOver(false)}
              onDrop={handleDropOnSpine}
              title="Drop here to insert and push the following cards along"
              className={`hidden shrink-0 items-center justify-center self-stretch rounded transition sm:flex ${
                spineDragOver ? "w-8 bg-amber-400/20" : "w-6"
              }`}
            >
              <div className="h-full w-px bg-gradient-to-b from-transparent via-black/60 to-transparent" />
            </div>
            <BinderPage
              slots={rightSlots}
              cols={layout.cols}
              holes="right"
              onPick={setPickerPosition}
              onRemove={clearSlot}
              onDropCard={swapSlots}
              onInsertAt={insertAtBoundary}
              style={
                flip?.side === "right"
                  ? {
                      transform: `rotateY(${flip.phase === "closing" ? "130deg" : "0deg"})`,
                      transition: `transform ${FLIP_MS}ms ease-in`,
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }
                  : undefined
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={addPage}
            title="Add page"
            aria-label="Add page"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-light text-white/70 hover:bg-white/10 hover:text-amber-300"
          >
            +
          </button>
          <button
            onClick={removePage}
            disabled={!canRemovePage}
            title="Remove the last page"
            aria-label="Remove the last page"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-light text-white/70 hover:bg-white/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-20"
          >
            −
          </button>
        </div>
      </div>

      {pickerPosition !== null && (
        <AddCardModal
          cards={cards}
          sets={sets}
          initialPosition={pickerPosition}
          filters={addFilters}
          onFiltersChange={setAddFilters}
          onCommit={commitQueue}
          onClose={() => setPickerPosition(null)}
        />
      )}
    </div>
  );
}
