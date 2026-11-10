"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string; hint?: string };

// A custom dropdown with a search box, replacing the native <select>. The list is rendered in a
// portal (position: fixed) so toolbars with overflow-hidden never clip it.
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  ariaLabel,
  title,
  className = "",
  menuMinWidth = 240,
  searchable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  title?: string;
  /** classes for the trigger button (height, padding, text size) */
  className?: string;
  menuMinWidth?: number;
  /** show the search box (default). Turn off for short lists. */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, menuMinWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const up = window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom;
    setPos({ left, top: up ? r.top - 6 : r.bottom + 6, width, up });
  }

  function openMenu() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    place();
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  }

  function choose(o: SelectOption) {
    onChange(o.value);
    close();
  }

  useLayoutEffect(() => {
    if (open) (searchable ? searchRef.current : menuRef.current)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-ink px-3 text-left text-t1 transition-colors hover:border-line2 focus-visible:outline-none ${
          open ? "border-brand-gold" : "border-line"
        } focus-visible:border-brand-gold ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-t3"}`}>{selected ? (selected.hint ? `${selected.hint} · ${selected.label}` : selected.label) : placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-4 w-4 shrink-0 text-t3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            tabIndex={-1}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, zIndex: 80 }}
            className="animate-fade-in overflow-hidden rounded-xl border border-line2 bg-panel outline-none"
            onKeyDown={onKeyDown}
          >
            {searchable && (
            <div className="border-b border-line p-2">
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-t3">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-md border border-line bg-ink pl-8 pr-2 text-sm text-t1 placeholder:text-t3"
                />
              </div>
            </div>
            )}
            <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 && <li className="px-3 py-3 text-center text-sm text-t3">No results</li>}
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value || "__none"}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm ${
                      i === active ? "bg-cavity text-t1" : "text-t2"
                    }`}
                  >
                    <span className="truncate">
                      {o.hint && <span className="mr-2 font-display text-xs tracking-widest text-brand-gold">{o.hint}</span>}
                      {o.label}
                    </span>
                    {isSel && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-gold">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
