"use client";

import { useEffect, useRef, useState } from "react";
import { PageGrid, pageBackground, type SlotView, type TouchMode } from "@/components/PageGrid";

const noop = () => {};

// Phone layout for a binder: one page at a time, swipe or use the big
// bottom bar to turn pages (the two-page flip book is far too small there).
export function MobileBinderView({
  page,
  totalPages,
  onPageChange,
  slotsForPage,
  cols,
  touch,
  onOpenMenu,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  slotsForPage: (pageIndex: number) => SlotView[];
  cols: number;
  touch: TouchMode;
  onOpenMenu: () => void;
}) {
  const [direction, setDirection] = useState<1 | -1>(1);
  const gesture = useRef<{ x: number; y: number } | null>(null);

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  function go(delta: 1 | -1) {
    const target = page + delta;
    if (target < 0 || target > totalPages - 1) return;
    setDirection(delta);
    onPageChange(target);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages]);

  function onTouchStart(e: React.TouchEvent) {
    gesture.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = gesture.current;
    gesture.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const gridProps = {
    cols,
    onPick: noop,
    onRemove: noop,
    onDropCard: noop,
    onInsertAt: noop,
    touch,
    compact: true,
  };

  const navButton =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-gold text-xl text-brand-gold transition active:bg-brand-gold/15 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/25";

  return (
    <div>
      <div
        className="rounded-2xl border border-white/[0.07] bg-[#101520] p-2 shadow-2xl"
        style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={page}
          className={`overflow-hidden rounded-xl motion-reduce:animate-none ${
            direction === 1 ? "animate-page-in-right" : "animate-page-in-left"
          }`}
          style={{ background: pageBackground("right") }}
        >
          <PageGrid slots={slotsForPage(page)} {...gridProps} />
        </div>
      </div>

      {/* Warm the browser cache for the neighbouring pages so a swipe doesn't wait on images. */}
      <div className="hidden" aria-hidden>
        {[page - 1, page + 1]
          .filter((i) => i >= 0 && i < totalPages)
          .map((i) => (
            <PageGrid key={i} slots={slotsForPage(i)} {...gridProps} />
          ))}
      </div>

      <div className="h-24" />

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!canPrev}
            aria-label="Previous page"
            className={navButton}
          >
            ←
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Go to page, layout and more"
            className="flex min-w-[88px] flex-col items-center rounded-lg px-2 py-0.5 active:bg-white/5"
          >
            <span className="font-display text-lg font-semibold tabular-nums text-white">
              {page + 1}
              <span className="text-white/40"> / {totalPages}</span>
            </span>
            <span className="text-[10px] uppercase tracking-wide text-white/40">Page</span>
          </button>
          <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="Next page" className={navButton}>
            →
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Binder menu"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
