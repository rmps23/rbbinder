"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MultiOption = { value: string; label: string; count?: number };

// Dropdown with a search box where several options can be ticked. The menu stays open while you pick.
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search…",
  ariaLabel,
  className = "",
  menuMinWidth = 260,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiOption[];
  placeholder: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  /** classes for the trigger button (height, text size) */
  className?: string;
  menuMinWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, menuMinWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const up = window.innerHeight - r.bottom < 340 && r.top > window.innerHeight - r.bottom;
    setPos({ left, top: up ? r.top - 6 : r.bottom + 6, width, up });
  }

  function openMenu() {
    setQuery("");
    setActive(0);
    place();
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  }

  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  useLayoutEffect(() => {
    if (open) searchRef.current?.focus();
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
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
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
      if (o) toggle(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  const labels = values.map((v) => options.find((o) => o.value === v)?.label ?? v);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openMenu())}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-ink px-3 text-left transition-colors hover:border-line2 focus-visible:outline-none focus-visible:border-brand-gold ${
          open ? "border-brand-gold" : "border-line"
        } ${className}`}
      >
        <span className={`truncate ${values.length ? "text-t1" : "text-t3"}`}>{values.length ? labels.join(", ") : placeholder}</span>
        <span className="flex shrink-0 items-center gap-2">
          {values.length > 0 && <span className="num rounded bg-brand-gold px-1.5 text-[11px] font-bold text-on-accent">{values.length}</span>}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-4 w-4 text-t3 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            onKeyDown={onKeyDown}
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, zIndex: 80 }}
            className="animate-fade-in overflow-hidden rounded-xl border border-line2 bg-panel"
          >
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
            <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={ariaLabel} className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 && <li className="px-3 py-3 text-center text-sm text-t3">No results</li>}
              {filtered.map((o, i) => {
                const on = values.includes(o.value);
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(o.value)}
                    className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm ${i === active ? "bg-cavity text-t1" : "text-t2"}`}
                  >
                    <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-gold bg-brand-gold text-on-accent" : "border-line2"}`}>
                      {on && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.count !== undefined && <span className="num text-xs text-t3">{o.count}</span>}
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-line p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={values.length === 0}
                className="h-9 rounded-md px-3 text-sm font-semibold text-t2 transition hover:bg-cavity hover:text-t1 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Clear
              </button>
              <button type="button" onClick={() => close()} className="h-9 rounded-md bg-cavity px-4 text-sm font-semibold text-t1 transition hover:bg-line2">
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
