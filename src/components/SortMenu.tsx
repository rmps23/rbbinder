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
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-ink px-3.5 text-sm text-t1 transition hover:border-line2 focus-visible:border-brand-gold"
      >
        <span className="text-t3">Sort</span>
        <span className="font-semibold">{current}</span>
        <span className="text-t3">{dir === "asc" ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-line2 bg-panel p-2">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">Sort by</p>
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
                      onChange(o.id, dir);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between min-h-10 rounded-md px-2.5 text-left text-sm transition ${
                      on ? "bg-cavity text-t1" : "text-t2 hover:bg-panel2"
                    }`}
                  >
                    {o.label}
                    {on && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">Direction</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["asc", "desc"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChange(sortBy, d)}
                className={`min-h-10 rounded-md border px-2 text-sm transition ${
                  dir === d ? "border-line2 bg-cavity text-t1" : "border-line text-t3 hover:bg-panel2"
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
