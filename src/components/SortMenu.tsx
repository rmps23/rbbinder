"use client";

import { useEffect, useRef, useState } from "react";
import { SORT_OPTIONS, type SortDir, type SortKey } from "@/lib/cardSort";

// "Sort by" picker with an Asc / Desc toggle, for the card pool.
export default function SortMenu({
  sortBy,
  dir,
  onChange,
}: {
  sortBy: SortKey;
  dir: SortDir;
  onChange: (sortBy: SortKey, dir: SortDir) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Name";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-full items-center gap-1.5 rounded-lg border border-white/10 bg-panel px-2.5 py-2 text-xs text-white/80 outline-none transition hover:bg-white/5 focus:border-brand-gold"
      >
        <span className="text-white/40">Sort</span>
        <span className="font-semibold">{current}</span>
        <span className="text-white/50">{dir === "asc" ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-white/10 bg-panel p-2 shadow-2xl">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Sort by</p>
          <ul role="listbox" className="flex flex-col">
            {SORT_OPTIONS.map((o) => {
              const on = o.id === sortBy;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      // "Owned" makes most sense most-first, so it starts descending
                      onChange(o.id, o.id === "owned" && !on ? "desc" : dir);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition ${
                      on ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {o.label}
                    {o.id === "owned" && !on && <span className="text-[10px] text-brand-cyan">most first</span>}
                    {on && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Direction</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["asc", "desc"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange(sortBy, d)}
                className={`rounded-md border px-2 py-1.5 text-sm transition ${
                  dir === d ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/50 hover:bg-white/5"
                }`}
              >
                {d === "asc" ? "Asc" : "Desc"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
