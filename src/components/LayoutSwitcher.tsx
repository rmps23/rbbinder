"use client";

import { BINDER_LAYOUTS } from "@/lib/constants";
import type { BinderLayout } from "@/lib/types";

export function LayoutSwitcher({
  value,
  onChange,
}: {
  value: BinderLayout;
  onChange: (layout: BinderLayout) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-white/10 bg-panel p-1">
      {BINDER_LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`rounded px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-wide transition ${
            value === l.id ? "bg-brand-gold text-ink" : "text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
