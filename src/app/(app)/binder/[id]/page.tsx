"use client";

import Link from "next/link";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { useHeaderToolbar } from "@/components/HeaderToolbarContext";
import { useBinderCards } from "@/lib/useBinderCards";
import { BinderSlotTile } from "@/components/BinderSlotTile";
import { AddCardModal } from "@/components/AddCardModal";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { FilterState } from "@/components/Filters";
import { BINDER_LAYOUTS, GRID_COLS_CLASS } from "@/lib/constants";
import type { Binder, BinderLayout, RiftCard } from "@/lib/types";

type SlotView = { position: number; card: RiftCard | null; qty: number };

// The book's imperative API (react-pageflip's TS defs type this as `any`).
type PageFlipHandle = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
  turnToPage: (page: number) => void;
};
type FlipBookHandle = { pageFlip: () => PageFlipHandle };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlipBookComponent = React.ComponentType<any>;

const REF_WIDTH = 420;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  altArt: "all",
  onlyOwned: false,
};

type PageGridProps = {
  slots: SlotView[];
  cols: number;
  onPick: (position: number) => void;
  onRemove: (position: number) => void;
  onDropCard: (from: number, to: number) => void;
  onInsertAt: (from: number, insertPosition: number) => void;
};

function PageGrid({ slots, cols, onPick, onRemove, onDropCard, onInsertAt }: PageGridProps) {
  return (
    <div className={`grid ${GRID_COLS_CLASS[cols]} h-full gap-3 p-3`}>
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
  );
}

// react-pageflip clones each page child to attach its own ref, so a page
// built from a component (rather than a plain <div>) has to forward it.
// The library rewrites the root element's inline style on every frame
// (cssText), so anything painted via style= on the root - like the page's
// background - gets wiped mid-flip and the page turns see-through. All the
// visuals therefore live on an inner div.
const FlipPage = forwardRef<HTMLDivElement, PageGridProps & { side: "left" | "right" }>(({ side, ...props }, ref) => (
  <div ref={ref} className="h-full w-full">
    <div
      className="h-full w-full overflow-hidden rounded-xl"
      style={{
        background:
          // Darkens toward the gutter, like paper curving down into the spine.
          `linear-gradient(${side === "left" ? 270 : 90}deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 9%, transparent 24%), ` +
          "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.05), transparent 60%), " +
          "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, transparent 30%, rgba(0,0,0,0.16) 100%), " +
          "#1a212c",
      }}
    >
      <PageGrid {...props} />
    </div>
  </div>
));
FlipPage.displayName = "FlipPage";

// The inside of the front cover: like a real binder, the first spread shows
// only a right-hand page, so book page 0 is a blank, never-used left side.
const CoverPage = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="h-full w-full">
    <div
      className="h-full w-full rounded-xl"
      style={{
        background:
          "linear-gradient(270deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 9%, transparent 24%), " +
          "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%), #141a24",
      }}
    />
  </div>
));
CoverPage.displayName = "CoverPage";

// A metal ring, like a real ring-binder mechanism straddling the gutter
// between two pages - an open oval rather than a flat dot, with a
// light-to-dark gradient stroke to read as cylindrical metal.
function BinderRing({ id }: { id: string }) {
  const gradientId = `ring-metal-${id}`;
  return (
    <svg width="44" height="26" viewBox="0 0 44 26" className="shrink-0" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.6))" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3dfa8" />
          <stop offset="45%" stopColor="#c9a24a" />
          <stop offset="100%" stopColor="#7a5c22" />
        </linearGradient>
      </defs>
      <ellipse cx="22" cy="13" rx="18" ry="10" fill="none" stroke={`url(#${gradientId})`} strokeWidth={5} />
    </svg>
  );
}

export default function BinderDetailPage() {
  const params = useParams<{ id: string }>();
  const binderId = params.id;
  const router = useRouter();
  const { cards, sets, loading: cardsLoading } = useAppData();
  const { slots, loading: slotsLoading, placeCard, clearSlot, swapSlots, insertAtBoundary } = useBinderCards(binderId);
  const { setToolbar } = useHeaderToolbar();
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [compactNavVisible, setCompactNavVisible] = useState(false);

  const [binder, setBinder] = useState<Binder | null>(null);
  const [binderLoading, setBinderLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // react-pageflip manipulates the DOM directly and isn't SSR-safe, so it's
  // imported client-side only, after mount (next/dynamic's own ssr:false
  // wrapper doesn't forward refs, which we need for the nav buttons).
  const [FlipBook, setFlipBook] = useState<FlipBookComponent | null>(null);
  useEffect(() => {
    let active = true;
    import("react-pageflip").then((mod) => {
      if (active) setFlipBook(() => mod.default);
    });
    return () => {
      active = false;
    };
  }, []);

  const bookRef = useRef<FlipBookHandle | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const jumpToEndRef = useRef(false);

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
  // Approximate width/height ratio for a page of this layout (card art is
  // 744x1039, gaps/padding ignored) - used to size the flip book so pages
  // don't come out stretched or squashed.
  const pageAspect = (layout.cols * 744) / (layout.rows * 1039);

  const highestPosition = useMemo(() => {
    const positions = Object.keys(slots).map(Number);
    return positions.length ? Math.max(...positions) : -1;
  }, [slots]);

  // At least binder.pageCount pages, but always one blank page past the
  // last filled one too, like turning to the next empty page of an album -
  // and always an even count, since the book always shows two at a time.
  const minPagesAllowed = Math.floor(highestPosition / perPage) + 2;
  const totalPages = Math.max(binder?.pageCount ?? 2, minPagesAllowed);
  const canRemovePage = totalPages > minPagesAllowed;
  // Book page 0 is the (unused) inside cover; data page N sits at book page N.
  const bookPageCount = Math.ceil((totalPages + 1) / 2) * 2;
  const leftPageIndex = Math.min(currentPage, bookPageCount - 2);
  const rightPageIndex = leftPageIndex + 1;
  const pageLabel =
    leftPageIndex === 0 ? "1" : rightPageIndex > totalPages ? `${leftPageIndex}` : `${leftPageIndex}–${rightPageIndex}`;

  function buildPageSlots(pageIndex: number): SlotView[] {
    return Array.from({ length: perPage }, (_, i) => {
      const position = pageIndex * perPage + i;
      const slot = slots[position];
      const card = slot ? cardById.get(slot.cardId) ?? null : null;
      return { position, card, qty: slot?.qty ?? 0 };
    });
  }

  const pages = useMemo(
    () => Array.from({ length: bookPageCount }, (_, i) => (i === 0 ? null : buildPageSlots(i - 1))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookPageCount, perPage, slots, cardById]
  );

  // The book rebuilds its whole page collection whenever its children change
  // identity, which looked like a hard flicker after every page turn (the
  // flip updates currentPage, which re-rendered fresh <FlipPage> elements).
  // Keeping the elements memoized - with handlers read through a ref so they
  // stay stable - means a flip no longer triggers a rebuild.
  const handlersRef = useRef({ clearSlot, swapSlots, insertAtBoundary });
  handlersRef.current = { clearSlot, swapSlots, insertAtBoundary };
  const stableHandlers = useMemo(
    () => ({
      onRemove: (position: number) => handlersRef.current.clearSlot(position),
      onDropCard: (from: number, to: number) => handlersRef.current.swapSlots(from, to),
      onInsertAt: (from: number, insertPosition: number) => handlersRef.current.insertAtBoundary(from, insertPosition),
    }),
    []
  );
  const pageElements = useMemo(
    () =>
      pages.map((pageSlots, i) =>
        pageSlots === null ? (
          <CoverPage key={i} />
        ) : (
        <FlipPage key={i} side={i % 2 === 0 ? "left" : "right"} slots={pageSlots} cols={layout.cols} onPick={setPickerPosition} {...stableHandlers} />
        )
      ),
    [pages, layout.cols, stableHandlers]
  );

  // If pages are removed out from under the page you're looking at, snap
  // back into range instead of leaving the book on a page that no longer
  // exists.
  useEffect(() => {
    if (currentPage > bookPageCount - 2) {
      const target = Math.max(0, bookPageCount - 2);
      requestAnimationFrame(() => bookRef.current?.pageFlip()?.turnToPage(target));
    }
  }, [bookPageCount, currentPage]);

  async function changeLayout(newLayout: BinderLayout) {
    setBinder((b) => (b ? { ...b, layout: newLayout } : b));
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: newLayout }),
    });
  }

  async function addPage() {
    const newPageCount = totalPages + 1;
    setBinder((b) => (b ? { ...b, pageCount: newPageCount } : b));
    jumpToEndRef.current = true;
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageCount: newPageCount }),
    });
  }

  // After the new page lands and the book's own page collection has had a
  // moment to rebuild, jump to the new last spread.
  useEffect(() => {
    if (jumpToEndRef.current) {
      jumpToEndRef.current = false;
      requestAnimationFrame(() => bookRef.current?.pageFlip()?.turnToPage(bookPageCount - 2));
    }
  }, [bookPageCount]);

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

  function goPrev() {
    bookRef.current?.pageFlip()?.flipPrev();
  }

  function goNext() {
    bookRef.current?.pageFlip()?.flipNext();
  }

  // Once the toolbar (with the page arrows) scrolls out from under the
  // sticky header, fade in a compact prev/next control in the header itself
  // instead, so paging through the binder never needs a scroll back up.
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCompactNavVisible(!entry.isIntersecting),
      { rootMargin: "-57px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Only needs to (re)attach once the toolbar element actually exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!binder]);

  const compactNav = (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2 pr-1.5 shadow-inner">
      <button
        onClick={goPrev}
        disabled={leftPageIndex === 0}
        aria-label="Previous pages"
        className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-brand-gold text-[11px] text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/30"
      >
        ←
      </button>
      <span className="min-w-[52px] text-center font-display text-[11px] font-semibold uppercase tracking-wide tabular-nums text-white/60">
        {pageLabel}/{totalPages}
      </span>
      <button
        onClick={goNext}
        disabled={rightPageIndex >= bookPageCount - 1}
        aria-label="Next pages"
        className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-brand-gold text-[11px] text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/30"
      >
        →
      </button>
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      <button
        onClick={addPage}
        title="Add page"
        aria-label="Add page"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold font-display text-sm font-semibold text-ink hover:bg-brand-goldSoft"
      >
        +
      </button>
      <button
        onClick={removePage}
        disabled={!canRemovePage}
        title="Remove the last page"
        aria-label="Remove the last page"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 font-display text-sm font-semibold text-white/60 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-20"
      >
        −
      </button>
    </div>
  );

  useEffect(() => {
    setToolbar({ node: compactNav, visible: compactNavVisible });
    return () => setToolbar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPageIndex, rightPageIndex, totalPages, bookPageCount, compactNavVisible]);

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
        <Link href="/" className="text-sm font-medium text-brand-gold hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div ref={toolbarRef} className="mb-4 overflow-hidden rounded-xl border border-white/[0.06] bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
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
              className="rounded-md border border-brand-gold/50 bg-ink px-2 py-1 font-display text-xl font-semibold uppercase tracking-wide text-white outline-none"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <h1
                onClick={() => setRenaming(true)}
                title="Click to rename"
                className="cursor-text font-display text-xl font-semibold uppercase tracking-wide text-white hover:text-brand-gold"
              >
                {binder.name}
              </h1>
              <button
                onClick={() => setRenaming(true)}
                title="Rename binder"
                aria-label="Rename binder"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/10 hover:text-brand-gold"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
                  />
                </svg>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <LayoutSwitcher value={binder.layout} onChange={changeLayout} />
            <button
              onClick={deleteBinder}
              className="rounded-md border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-xs font-medium text-brand-red hover:bg-brand-red/20"
            >
              Delete binder
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-2.5">
          <button
            onClick={goPrev}
            disabled={leftPageIndex === 0}
            aria-label="Previous pages"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-brand-gold text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/30"
          >
            ←
          </button>
          <span className="min-w-[130px] text-center font-display text-xs font-semibold uppercase tracking-wide text-white/50">
            {pageLabel.includes("–") ? "Pages" : "Page"} {pageLabel} of {totalPages}
          </span>
          <button
            onClick={goNext}
            disabled={rightPageIndex >= bookPageCount - 1}
            aria-label="Next pages"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-brand-gold text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/30"
          >
            →
          </button>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <button
            onClick={addPage}
            title="Add page"
            aria-label="Add page"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold font-display text-base font-semibold text-ink hover:bg-brand-goldSoft"
          >
            +
          </button>
          <button
            onClick={removePage}
            disabled={!canRemovePage}
            title="Remove the last page"
            aria-label="Remove the last page"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-ink font-display text-base font-semibold text-white/60 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-20"
          >
            −
          </button>
        </div>
      </div>

      <p className="mb-4 text-center text-sm text-white/40">{binderStats.totalQty} cards placed</p>

      <div className="relative flex items-center justify-center rounded-2xl border border-white/[0.07] bg-[#101520] p-2 shadow-2xl sm:p-4">
        <div className="pointer-events-none absolute inset-y-10 left-1/2 -z-10 flex w-0 -translate-x-1/2 flex-col items-center justify-between sm:inset-y-14">
          {[0, 1, 2, 3].map((i) => (
            <BinderRing key={i} id={String(i)} />
          ))}
        </div>
        {FlipBook ? (
          <FlipBook
            key={layout.id}
            ref={bookRef}
            width={REF_WIDTH}
            height={Math.round(REF_WIDTH / pageAspect)}
            size="stretch"
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
            minHeight={Math.round(MIN_WIDTH / pageAspect)}
            maxHeight={Math.round(MAX_WIDTH / pageAspect)}
            startPage={0}
            drawShadow
            flippingTime={800}
            usePortrait
            startZIndex={0}
            autoSize
            maxShadowOpacity={0.5}
            showCover={false}
            mobileScrollSupport
            swipeDistance={30}
            clickEventForward
            useMouseEvents={false}
            showPageCorners={false}
            disableFlipByClick
            className=""
            style={{}}
            onFlip={(e: { data: number }) => setCurrentPage(e.data)}
            onInit={(e: { data: { page: number } }) => setCurrentPage(e.data.page)}
          >
            {pageElements}
          </FlipBook>
        ) : (
          <p className="py-10 text-center text-white/40">Loading binder...</p>
        )}
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
