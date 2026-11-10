"use client";

import { BinderSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { useHeaderToolbar } from "@/components/HeaderToolbarContext";
import { useBinderCards } from "@/lib/useBinderCards";
import { AddCardModal } from "@/components/AddCardModal";
import { ScanCardModal } from "@/components/ScanCardModal";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { PageGrid, pageBackground, type PageGridProps, type SlotView } from "@/components/PageGrid";
import { MobileBinderView } from "@/components/MobileBinderView";
import { BinderMenuSheet } from "@/components/BinderMenuSheet";
import { CardSheet } from "@/components/CardSheet";
import { CardDetailModal } from "@/components/CardDetailModal";
import { Select } from "@/components/Select";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { typicalFinish } from "@/lib/cardFinish";
import { formatEur } from "@/lib/format";
import { baseCardsOf, setProgress } from "@/lib/setCollection";
import { cardmarketWants } from "@/lib/wants";
import { WantsModal } from "@/components/WantsModal";
import { FilterState } from "@/components/Filters";
import { BINDER_LAYOUTS } from "@/lib/constants";
import type { Binder, BinderLayout, RiftCard } from "@/lib/types";

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
const MAX_WIDTH = 900;

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  altArt: "all",
  onlyOwned: false,
};

// react-pageflip clones each page child to attach its own ref, so a page
// built from a component (rather than a plain <div>) has to forward it.
// The library rewrites the root element's inline style on every frame
// (cssText), so anything painted via style= on the root - like the page's
// background - gets wiped mid-flip and the page turns see-through. All the
// visuals therefore live on an inner div.
const FlipPage = forwardRef<HTMLDivElement, PageGridProps & { side: "left" | "right" }>(({ side, ...props }, ref) => (
  <div ref={ref} className="h-full w-full">
    <div className="h-full w-full overflow-hidden rounded-xl border border-white/10" style={{ background: pageBackground(side) }}>
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
      className="h-full w-full rounded-xl border border-white/10"
      style={{
        background:
          "linear-gradient(270deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 9%, transparent 24%), " +
          "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%), #1f2838",
      }}
    />
  </div>
));
CoverPage.displayName = "CoverPage";

export default function BinderDetailPage() {
  const params = useParams<{ id: string }>();
  const binderId = params.id;
  const router = useRouter();
  const { cards, sets, bulk, loading: cardsLoading, prices, priceOf } = useAppData();
  const {
    slots,
    loading: slotsLoading,
    placeCard,
    addCopy,
    setQty,
    clearSlot,
    swapSlots,
    insertAtBoundary,
  } = useBinderCards(binderId);
  const { setToolbar } = useHeaderToolbar();
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [compactNavVisible, setCompactNavVisible] = useState(false);

  const [binder, setBinder] = useState<Binder | null>(null);
  const [binderLoading, setBinderLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  // Phones get a one-page-at-a-time viewer instead of the two-page flip book.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobilePage, setMobilePage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<number | null>(null);
  const [inspectPosition, setInspectPosition] = useState<number | null>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // react-pageflip manipulates the DOM directly and isn't SSR-safe, so it's
  // imported client-side only, after mount (next/dynamic's own ssr:false
  // wrapper doesn't forward refs, which we need for the nav buttons).
  const [FlipBook, setFlipBook] = useState<FlipBookComponent | null>(null);
  useEffect(() => {
    if (isMobile) return;
    let active = true;
    import("react-pageflip").then((mod) => {
      if (active) setFlipBook(() => mod.default);
    });
    return () => {
      active = false;
    };
  }, [isMobile]);

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
    let value = 0;
    for (const slot of Object.values(slots)) {
      if (slot.qty <= 0) continue;
      cardIds.add(slot.cardId);
      totalQty += slot.qty;
      const card = cardById.get(slot.cardId);
      const price = card ? priceOf(card, typicalFinish(card)) : null;
      if (price !== null) value += price * slot.qty;
    }
    return { uniqueCount: cardIds.size, totalQty, value, cardIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, cardById, prices]);

  // Set collection progress: one of each regular card of the binder's set.
  const setProg = useMemo(
    () => (binder?.setId ? setProgress(cards, binder.setId, binderStats.cardIds) : null),
    [binder?.setId, cards, binderStats.cardIds]
  );
  // Cards still missing to complete the set (regular versions, one of each).
  const [wantsOpen, setWantsOpen] = useState(false);
  const [skipBulk, setSkipBulk] = useState(true);
  const missingForSet = useMemo(() => {
    if (!binder?.setId) return [];
    return baseCardsOf(cards, binder.setId).filter((c) => !binderStats.cardIds.has(c.id));
  }, [binder?.setId, cards, binderStats.cardIds]);
  const inBulk = (id: string) => (bulk[id]?.normal ?? 0) + (bulk[id]?.foil ?? 0) > 0;

  const setName = binder?.setId ? (sets.find((s) => s.id === binder.setId)?.name ?? binder.setId) : null;

  const layout = BINDER_LAYOUTS.find((l) => l.id === binder?.layout) ?? BINDER_LAYOUTS[1];
  const perPage = layout.cols * layout.rows;
  // Approximate width/height ratio for a page of this layout (card art is
  // 744x1039, gaps/padding ignored) - used to size the flip book so pages
  // don't come out stretched or squashed.
  const pageAspect = (layout.cols * 744) / (layout.rows * 1039);
  // Fit the open book to the window: as wide as the content area allows, but never taller
  // than the viewport (minus the toolbar above it), so a page is always fully visible.
  const [viewH, setViewH] = useState(900);
  useEffect(() => {
    const update = () => setViewH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const bookMaxWidth = Math.round(2 * Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, (viewH - 225) * pageAspect)));
  // The flip book measures itself once on mount, before the wrapper above has its final width,
  // and would stay at its minimum page size. Nudge it to re-measure whenever the target size changes.
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      const parent = document.querySelector<HTMLElement>(".stf__parent");
      const item = parent?.querySelector<HTMLElement>(".stf__item");
      const ok = parent && item && Math.abs(item.offsetWidth * 2 - parent.offsetWidth) < 4;
      if (ok || ++tries > 25) return window.clearInterval(id);
      if (item) window.dispatchEvent(new Event("resize"));
    }, 400);
    return () => window.clearInterval(id);
  }, [bookMaxWidth, layout.id, isMobile, FlipBook]);

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
  const currentMobilePage = Math.min(mobilePage, totalPages - 1);
  const pageLabel =
    leftPageIndex === 0 ? "1" : rightPageIndex > totalPages ? `${leftPageIndex}` : `${leftPageIndex}–${rightPageIndex}`;

  function buildPageSlots(pageIndex: number): SlotView[] {
    return Array.from({ length: perPage }, (_, i) => {
      const position = pageIndex * perPage + i;
      const slot = slots[position];
      const card = slot ? (cardById.get(slot.cardId) ?? null) : null;
      return { position, card, qty: slot?.qty ?? 0 };
    });
  }

  const pages = useMemo(
    () => Array.from({ length: bookPageCount }, (_, i) => (i === 0 ? null : buildPageSlots(i - 1))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookPageCount, perPage, slots, cardById],
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
    [],
  );
  const pageElements = useMemo(
    () =>
      pages.map((pageSlots, i) =>
        pageSlots === null ? (
          <CoverPage key={i} />
        ) : (
          <FlipPage
            key={i}
            side={i % 2 === 0 ? "left" : "right"}
            slots={pageSlots}
            cols={layout.cols}
            onPick={setPickerPosition}
            onInspect={setInspectPosition}
            {...stableHandlers}
          />
        ),
      ),
    [pages, layout.cols, stableHandlers],
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

  async function changeSet(setId: string | null) {
    const previous = binder?.setId ?? null;
    setBinder((b) => (b ? { ...b, setId } : b));
    const res = await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setId }),
    });
    if (!res.ok) {
      setBinder((b) => (b ? { ...b, setId: previous } : b));
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't change the set.");
    }
  }

  async function addPage() {
    const newPageCount = totalPages + 1;
    setBinder((b) => (b ? { ...b, pageCount: newPageCount } : b));
    jumpToEndRef.current = true;
    setMobilePage(totalPages);
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

  // Scanned cards land in their own slot; bring that spread into view.
  function handleScanAdd(card: RiftCard, position: number) {
    addCopy(position, card.id);
    setMobilePage(Math.floor(position / perPage));
    const bookIndex = Math.floor(position / perPage) + 1;
    bookRef.current?.pageFlip()?.turnToPage(Math.floor(bookIndex / 2) * 2);
  }

  // Once the toolbar (with the page arrows) scrolls out from under the
  // sticky header, fade in a compact prev/next control in the header itself
  // instead, so paging through the binder never needs a scroll back up.
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setCompactNavVisible(!entry.isIntersecting), {
      rootMargin: "-57px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
    // Only needs to (re)attach once the toolbar element actually exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!binder]);

  const compactNav = (
    <div className="flex items-center gap-2 rounded-md border border-line bg-panel2 py-1 pl-2 pr-1.5 ">
      <button
        onClick={goPrev}
        disabled={leftPageIndex === 0}
        aria-label="Previous pages"
        className="flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-brand-gold text-[11px] text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-line disabled:text-t3"
      >
        ←
      </button>
      <span className="min-w-[52px] text-center font-display text-[11px] font-semibold uppercase tracking-wide tabular-nums text-t2">
        {pageLabel}/{totalPages}
      </span>
      <button
        onClick={goNext}
        disabled={rightPageIndex >= bookPageCount - 1}
        aria-label="Next pages"
        className="flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-brand-gold text-[11px] text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:border-line disabled:text-t3"
      >
        →
      </button>
      <span className="mx-0.5 h-4 w-px bg-cavity" />
      <button
        onClick={addPage}
        title="Add page"
        aria-label="Add page"
        className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-gold font-display text-sm font-semibold text-ink hover:bg-brand-goldSoft"
      >
        +
      </button>
      <button
        onClick={removePage}
        disabled={!canRemovePage}
        title="Remove the last page"
        aria-label="Remove the last page"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-line font-display text-sm font-semibold text-t2 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-20"
      >
        −
      </button>
    </div>
  );

  useEffect(() => {
    if (isMobile) return;
    setToolbar({ node: compactNav, visible: compactNavVisible });
    return () => setToolbar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPageIndex, rightPageIndex, totalPages, bookPageCount, compactNavVisible, isMobile]);

  // Phone interactions: tap a card for its details, tap an empty slot to add
  // one, and in "move" mode tap the destination slot.
  function handleMobileTap(position: number) {
    if (moveFrom !== null) {
      if (position !== moveFrom) swapSlots(moveFrom, position);
      setMoveFrom(null);
      return;
    }
    const slot = slots[position];
    if (slot && slot.qty > 0) setSheetPosition(position);
    else setPickerPosition(position);
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
    router.push("/binders");
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
    return <BinderSkeleton />;
  }

  if (notFound || !binder) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-t3">Binder not found.</p>
        <Link href="/binders" className="text-sm font-medium text-brand-gold hover:underline">
          Back to binders
        </Link>
      </div>
    );
  }

  const nameInput = (className: string) => (
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
      className={className}
    />
  );
  const inspectSlot = inspectPosition !== null ? slots[inspectPosition] : undefined;
  const inspectCard = inspectSlot ? cardById.get(inspectSlot.cardId) : undefined;
  const sheetSlot = sheetPosition !== null ? slots[sheetPosition] : undefined;
  const sheetCard = sheetSlot ? cardById.get(sheetSlot.cardId) : undefined;
  const movingSlot = moveFrom !== null ? slots[moveFrom] : undefined;
  const movingCard = movingSlot ? cardById.get(movingSlot.cardId) : undefined;

  return (
    <div>
      {/* Phone toolbar: title + the two things you reach for most; the rest lives in the menu sheet. */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        {renaming ? (
          nameInput(
            "h-10 min-w-0 flex-1 rounded-lg border border-brand-gold/50 bg-ink px-3 font-display text-lg font-semibold uppercase tracking-wide text-t1 outline-none",
          )
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            aria-label="Rename binder"
            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
          >
            <h1 className="truncate font-display text-xl font-semibold uppercase tracking-wide text-t1">
              {binder.name}
            </h1>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 shrink-0 text-t3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-brand-gold px-4 font-display text-xs font-semibold uppercase tracking-wide text-ink active:bg-brand-goldSoft"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
            />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
          Scan
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Binder menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-t2 active:bg-cavity"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      <div ref={toolbarRef} className="mb-4 hidden rounded-xl border border-line bg-panel md:block">
        {/* row 1: identity + actions */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            {renaming ? (
              nameInput(
                "h-11 rounded-lg border border-brand-gold bg-ink px-3 font-display text-xl font-semibold uppercase tracking-wide text-t1 outline-none",
              )
            ) : (
              <div className="flex items-center gap-1">
                <h1
                  onClick={() => setRenaming(true)}
                  title="Click to rename"
                  className="cursor-text truncate font-display text-2xl font-semibold uppercase tracking-wide text-t1 hover:text-brand-gold"
                >
                  {binder.name}
                </h1>
                <button
                  onClick={() => setRenaming(true)}
                  title="Rename binder"
                  aria-label="Rename binder"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-t3 transition hover:bg-cavity hover:text-t1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
                    />
                  </svg>
                </button>
              </div>
            )}
            <p className="num hidden whitespace-nowrap text-sm text-t3 lg:block">
              <b className="text-t1">{binderStats.totalQty}</b> cards placed
              {prices && binderStats.value > 0 && (
                <>
                  {" "}
                  · <b className="text-t1">{formatEur(binderStats.value)}</b>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWantsOpen(true)}
              title="Cards missing to complete this binder's set - as a Cardmarket wants list"
              className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1"
            >
              Missing cards
            </button>
            <button
              onClick={deleteBinder}
              className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-bad/50 hover:bg-bad/10 hover:text-bad"
            >
              Delete
            </button>
            <button
              onClick={() => setScanning(true)}
              className="btn-3d inline-flex h-11 items-center rounded-lg px-5 font-display text-xs font-semibold uppercase tracking-wide"
            >
              Scan cards
            </button>
          </div>
        </div>

        {/* row 2: pages, set, layout, progress */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={leftPageIndex === 0}
              aria-label="Previous pages"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-t1 transition hover:border-line2 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <span className="num min-w-[112px] text-center text-sm text-t2" aria-live="polite">
              {pageLabel.includes("–") ? "Pages" : "Page"} <b className="text-t1">{pageLabel}</b> / {totalPages}
            </span>
            <button
              onClick={goNext}
              disabled={rightPageIndex >= bookPageCount - 1}
              aria-label="Next pages"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-t1 transition hover:border-line2 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
            <button
              onClick={addPage}
              title="Add page"
              aria-label="Add page"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-brand-gold transition hover:border-brand-gold hover:bg-brand-gold/10"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button
              onClick={removePage}
              disabled={!canRemovePage}
              title="Remove the last page"
              aria-label="Remove the last page"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-t2 transition hover:border-bad/50 hover:text-bad disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-t2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M5 12h14" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-56">
              <Select
                value={binder.setId ?? ""}
                onChange={(v) => changeSet(v || null)}
                title="Set this binder collects"
                ariaLabel="Set this binder collects"
                searchPlaceholder="Search sets…"
                className="h-11 text-sm"
                options={[{ value: "", label: "No set" }, ...sets.map((s) => ({ value: s.id, label: s.name, hint: s.id }))]}
              />
            </div>
            <LayoutSwitcher value={binder.layout} onChange={changeLayout} />
          </div>

          {setProg && (
            <div className="flex min-w-[240px] flex-1 items-center gap-3 lg:ml-auto lg:max-w-md" title="One of each regular card - alternate arts, overnumbered and showcase cards don't count">
              <div className="h-2 flex-1 overflow-hidden rounded-sm bg-cavity">
                <div className="h-full rounded-sm bg-brand-gold" style={{ width: `${setProg.pct * 100}%` }} />
              </div>
              <span className="num whitespace-nowrap text-sm text-t2">
                <b className="text-t1">{setProg.have}</b> / {setProg.total} · {Math.round(setProg.pct * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="mb-3 text-center text-sm text-t3 md:hidden">{binderStats.totalQty} cards placed
        {prices && binderStats.value > 0 && (
          <span title="Cardmarket price trend in euros (TCGplayer where unavailable). Cards that exist in both finishes are valued as normal.">
            {" "}
            ·  {formatEur(binderStats.value)}
          </span>
        )}
      </p>
      {setProg && (
        <div className="mx-auto mb-4 max-w-md md:hidden" title="One of each regular card - alternate arts, overnumbered and showcase cards don't count">
          <div className="mb-1 flex items-baseline justify-between text-xs text-t2">
            <span>
              <b className="font-display tracking-widest text-brand-gold">{binder.setId}</b> {setName}
            </span>
            <span>
              <b className="text-t1">{setProg.have}</b> / {setProg.total} · {Math.round(setProg.pct * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-cavity">
            <div
              className="h-full rounded-md bg-brand-gold transition-all duration-700"
              style={{ width: `${setProg.pct * 100}%` }}
            />
          </div>
        </div>
      )}

      {isMobile && moveFrom !== null && (
        <div className="sticky top-2 z-10 mb-3 flex items-center justify-between gap-3 rounded-xl border border-ok/40 bg-ink/95 px-3 py-2.5 ">
          <p className="text-sm text-t1">
            Tap a slot to move <span className="font-semibold text-ok">{movingCard?.name ?? "the card"}</span>{" "}
            there
          </p>
          <button
            type="button"
            onClick={() => setMoveFrom(null)}
            className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs text-t1 active:bg-cavity"
          >
            Cancel
          </button>
        </div>
      )}

      {isMobile ? (
        <MobileBinderView
          page={currentMobilePage}
          totalPages={totalPages}
          onPageChange={setMobilePage}
          slotsForPage={buildPageSlots}
          cols={layout.cols}
          touch={{ selected: moveFrom, moveActive: moveFrom !== null, onTap: handleMobileTap }}
          onOpenMenu={() => setMenuOpen(true)}
        />
      ) : (
        <div className="relative flex items-stretch gap-2 rounded-xl border border-line bg-ink p-2 sm:p-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={leftPageIndex === 0}
            aria-label="Previous pages"
            className="group z-10 flex min-w-14 flex-1 items-center justify-center rounded-lg text-t3 transition hover:bg-cavity/60 hover:text-t1 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-t3"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-panel2 transition group-hover:border-line2 group-enabled:group-hover:bg-cavity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </span>
          </button>
          {FlipBook ? (
            <div className="min-w-0 flex-[0_1_auto]" style={{ width: bookMaxWidth }}>
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
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center"><div className="h-[420px] w-full max-w-[640px] animate-pulse rounded-xl bg-cavity/70" aria-hidden="true" /></div>
          )}
          {rightPageIndex >= bookPageCount - 1 ? (
            <button
              type="button"
              onClick={addPage}
              aria-label="Add a new page"
              className="group z-10 flex min-w-14 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line2 text-t2 transition hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-current">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-7 w-7" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.08em]">New page</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={rightPageIndex >= bookPageCount - 1}
              aria-label="Next pages"
              className="group z-10 flex min-w-14 flex-1 items-center justify-center rounded-lg text-t3 transition hover:bg-cavity/60 hover:text-t1 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-t3"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-panel2 transition group-hover:border-line2 group-enabled:group-hover:bg-cavity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </span>
            </button>
          )}
        </div>
      )}

      {wantsOpen && (
        <WantsModal
          title={binder.setId ? `Missing from ${setName}` : "Missing cards"}
          fileName={`${binder.name} - missing`}
          intro={
            binder.setId
              ? `${missingForSet.length} regular card${missingForSet.length === 1 ? "" : "s"} of ${setName} aren't in this binder (no alt arts, overnumbered or foil needed).`
              : "Choose the set this binder collects first (next to the layout buttons, or in the binder menu on a phone)."
          }
          text={cardmarketWants(
            missingForSet.filter((c) => !(skipBulk && inBulk(c.id))).map((card) => ({ card, qty: 1 })),
            cards
          )}
          onClose={() => setWantsOpen(false)}
        >
          {binder.setId && (
            <label className="mb-2 flex items-center gap-2 text-xs text-t2">
              <input type="checkbox" checked={skipBulk} onChange={(e) => setSkipBulk(e.target.checked)} />
              Leave out cards I already have in my bulk ({missingForSet.filter((c) => inBulk(c.id)).length})
            </label>
          )}
        </WantsModal>
      )}

      {menuOpen && (
        <BinderMenuSheet
          layout={binder.layout}
          onLayout={changeLayout}
          sets={sets}
          setId={binder.setId ?? null}
          onSet={changeSet}
          onMissing={() => setWantsOpen(true)}
          page={currentMobilePage + 1}
          totalPages={totalPages}
          onGoTo={(n) => setMobilePage(n - 1)}
          canRemovePage={canRemovePage}
          onAddPage={addPage}
          onRemovePage={removePage}
          onRename={() => {
            setRenaming(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onDelete={deleteBinder}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {inspectPosition !== null && inspectSlot && inspectCard && (
        <CardDetailModal
          card={inspectCard}
          qty={inspectSlot.qty}
          onQty={(n) => setQty(inspectPosition, inspectCard.id, n)}
          onRemove={() => {
            clearSlot(inspectPosition);
            setInspectPosition(null);
          }}
          onClose={() => setInspectPosition(null)}
        />
      )}

      {sheetPosition !== null && sheetSlot && sheetCard && (
        <CardSheet
          card={sheetCard}
          qty={sheetSlot.qty}
          onQty={(n) => {
            setQty(sheetPosition, sheetCard.id, n);
            if (n <= 0) setSheetPosition(null);
          }}
          onMove={() => {
            setMoveFrom(sheetPosition);
            setSheetPosition(null);
          }}
          onRemove={() => {
            clearSlot(sheetPosition);
            setSheetPosition(null);
          }}
          onClose={() => setSheetPosition(null)}
        />
      )}

      {scanning && (
        <ScanCardModal
          cards={cards}
          slots={slots}
          perPage={perPage}
          onAdd={handleScanAdd}
          onClose={() => setScanning(false)}
        />
      )}

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
