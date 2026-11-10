"use client";

import { SlideGroup } from "@/components/SlideGroup";
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
    <SlideGroup className="flex h-11 items-stretch gap-1 rounded-lg border border-line bg-ink p-1" role="radiogroup" aria-label="Pockets per page">
      {BINDER_LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          data-active={value === l.id}
          aria-checked={value === l.id}
          onClick={() => onChange(l.id)}
          className={`rounded-md px-3 text-sm font-semibold transition ${
            value === l.id ? "text-on-accent" : "text-t2 hover:text-t1"
          }`}
        >
          {l.label}
        </button>
      ))}
    </SlideGroup>
  );
}
