"use client";

import Link from "next/link";
import { BINDER_LAYOUTS } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import type { Binder } from "@/lib/types";

// Each binder gets its own leather-and-gradient cover, picked from its id so it
// never changes.
export const COVERS = [
  { from: "#2a2c30", to: "#151618", glow: "#a1a1aa", name: "Graphite" },
  { from: "#26303a", to: "#13181d", glow: "#94a3b8", name: "Slate" },
  { from: "#2b302b", to: "#151815", glow: "#a3ab9f", name: "Sage" },
  { from: "#302c28", to: "#181614", glow: "#b0a89e", name: "Stone" },
  { from: "#2a2a35", to: "#14141a", glow: "#a5a3b8", name: "Dusk" },
  { from: "#233033", to: "#111819", glow: "#93aaad", name: "Teal grey" },
];

export function coverFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

// Little grid of pockets, lit up according to how full the binder is.
export function PocketGrid({ layout, fill, glow }: { layout: Binder["layout"]; fill: number; glow: string }) {
  const l = BINDER_LAYOUTS.find((x) => x.id === layout) ?? BINDER_LAYOUTS[1];
  const cells = l.cols * l.rows;
  const lit = Math.round(cells * Math.min(1, fill));
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${l.cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className="aspect-[744/1039] rounded-[3px] border transition-all duration-500"
          style={
            i < lit
              ? { background: glow, borderColor: glow, transitionDelay: `${i * 25}ms` }
              : { background: "rgb(var(--cavity))", borderColor: "rgb(var(--line))" }
          }
        />
      ))}
    </div>
  );
}

export function BinderCard({
  binder,
  value,
  completion,
  progressLabel,
  onDelete,
}: {
  binder: Binder;
  value: number | null;
  completion: number; // 0..1 - of its set's base cards when it collects a set
  progressLabel?: string; // e.g. "120 / 298 of Origins"
  onDelete?: () => void;
}) {
  const cover = coverFor(binder.id);
  const l = BINDER_LAYOUTS.find((x) => x.id === binder.layout) ?? BINDER_LAYOUTS[1];
  const perPage = l.cols * l.rows;
  const fill = binder.totalQty / Math.max(1, perPage * binder.pageCount);

  const words = binder.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const mark = (binder.setId ?? (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3))).slice(0, 3).toUpperCase();
  const pct = Math.round(Math.min(1, completion) * 100);

  return (
    <div className="group relative h-full">
      <Link
        href={`/binder/${binder.id}`}
        className="relative flex h-full animate-card-in flex-col justify-between gap-5 rounded-xl border border-line bg-panel p-5 transition hover:border-line2 hover:bg-panel2"
      >
        <span className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line2 bg-cavity font-display text-xl font-bold tracking-wider text-white"
          >
            {mark}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words font-display text-base font-semibold uppercase leading-tight text-t1">{binder.name}</span>
            <span className="mt-0.5 block text-xs text-t3">
              {l.label} · {binder.uniqueCount} unique · {binder.totalQty} copies
            </span>
          </span>
        </span>

        <span className="block">
          {value !== null && (
            <span className="mb-3 block">
              <span className="label block">Value</span>
              <span className="num block text-2xl font-bold leading-tight text-t1">{formatEur(value)}</span>
            </span>
          )}
          <span className="mb-1.5 flex items-baseline justify-between gap-3 text-xs text-t2">
            <span className="truncate">{progressLabel ?? `${binder.pageCount} pages · ${Math.round(fill * 100)}% full`}</span>
            <b className="num text-t1">{progressLabel ? pct : Math.round(fill * 100)}%</b>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-sm bg-cavity">
            <span className="block h-full rounded-sm bg-brand-gold" style={{ width: `${progressLabel ? Math.min(100, completion * 100) : Math.min(100, fill * 100)}%` }} />
          </span>
        </span>
      </Link>

      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete binder"
          aria-label={`Delete ${binder.name}`}
          className="absolute -right-2 -top-2 z-10 flex h-11 w-11 items-center justify-center rounded-md border border-line bg-panel2 text-t2 transition hover:bg-bad hover:text-on-accent md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
