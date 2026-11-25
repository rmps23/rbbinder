"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { CardArt } from "@/components/DeckViews";
import { cardKey } from "@/lib/deck";
import { baseCardsOf } from "@/lib/setCollection";
import { useBinders } from "@/lib/useBinders";
import type { RiftCard } from "@/lib/types";

// A bell with the things worth your attention. For now: cards that sit in your bulk although a binder that
// collects their set doesn't have them yet.
export function NotificationsBell({ className = "", asNav = false }: { className?: string; asNav?: boolean }) {
  const { cards, bulk } = useAppData();
  const { binders, reload } = useBinders();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notices = useMemo(() => {
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const owned = (id: string) => (bulk[id]?.normal ?? 0) + (bulk[id]?.foil ?? 0) > 0;
    return binders
      .filter((b) => b.setId)
      .map((b) => {
        // any printing of a card in the binder counts (e.g. a promo swapped in for the regular one)
        const haveKeys = new Set<string>();
        for (const id of Object.keys(b.contents ?? {})) {
          const c = cardById.get(id);
          if (c) haveKeys.add(cardKey(c));
        }
        const movable: RiftCard[] = baseCardsOf(cards, b.setId as string).filter((c) => !haveKeys.has(cardKey(c)) && owned(c.id));
        return { binder: b, cards: movable };
      })
      .filter((n) => n.cards.length > 0);
  }, [binders, cards, bulk]);
  const total = notices.reduce((n, x) => n + x.cards.length, 0);

  // fresh data whenever the panel opens (a binder may have changed on another page)
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={total ? `Notifications, ${total} cards to move to binders` : "Notifications, nothing new"}
        title={asNav ? undefined : "Notifications"}
        className={
          asNav
            ? `relative flex min-h-11 items-center gap-3 rounded-lg px-[14px] text-sm font-semibold transition-colors hover:bg-panel2 ${open ? "bg-panel2 text-t1" : "text-t2"} ${className}`
            : `relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition ${
                open ? "border-brand-gold text-brand-gold" : "border-line text-t2 hover:border-line2 hover:text-t1"
              } ${className}`
        }
      >
        <span className="relative shrink-0" style={asNav ? { color: "rgb(var(--warn))" } : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={asNav ? 1.8 : 2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />
          </svg>
          {total > 0 && (
            <span className="num absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-none text-on-accent">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </span>
        {asNav && (
          <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">Notifications</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="fixed left-3 right-3 top-16 z-[60] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-line2 bg-panel md:left-20 md:right-auto md:top-3 md:w-[400px]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-semibold uppercase tracking-[0.08em] text-t1">Notifications</h2>
            <span className={`num rounded-md px-2 py-0.5 text-xs font-semibold ${total ? "bg-brand-gold/15 text-brand-gold" : "bg-cavity text-t3"}`}>{total}</span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {notices.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-t3">✓ All caught up. No card in your bulk is missing from a binder.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notices.map(({ binder, cards: list }) => (
                  <li key={binder.id} className="rounded-lg border border-brand-gold/40 bg-brand-gold/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-t1">
                        <b className="num">{list.length}</b> card{list.length === 1 ? "" : "s"} in your bulk {list.length === 1 ? "belongs" : "belong"} in{" "}
                        <b>{binder.name}</b>
                      </p>
                      <Link
                        href={`/binder/${binder.id}`}
                        onClick={() => setOpen(false)}
                        className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-semibold text-t1 transition hover:border-line2 hover:bg-panel2"
                      >
                        Open
                      </Link>
                    </div>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {list.slice(0, 8).map((c) => (
                        <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-ink p-1.5">
                          <CardArt card={c} sizes="64px" className="w-8 shrink-0 rounded" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-t1">{c.subtitle ? `${c.name}, ${c.subtitle}` : c.name}</span>
                            <span className="num text-[11px] text-t3">{c.publicCode}</span>
                          </span>
                          <span className="num shrink-0 text-xs text-t2">
                            ×{(bulk[c.id]?.normal ?? 0) + (bulk[c.id]?.foil ?? 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {list.length > 8 && <p className="mt-2 text-xs text-t3">…and {list.length - 8} more. Open the binder to see them all.</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
