"use client";

import Link from "next/link";
import { BINDER_LAYOUTS } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import type { Binder } from "@/lib/types";

// Each binder gets its own leather-and-gradient cover, picked from its id so it
// never changes.
export const COVERS = [
  { from: "#26452f", to: "#0b1610", glow: "#a3e635", name: "Moss" },
  { from: "#1c4d8a", to: "#0b1d36", glow: "#5aa2ff", name: "Ocean" },
  { from: "#157a78", to: "#06282a", glow: "#2dd4bf", name: "Teal" },
  { from: "#3d3a7a", to: "#14122e", glow: "#8f8cff", name: "Indigo" },
  { from: "#3a4a5e", to: "#10161f", glow: "#9fb4cc", name: "Steel" },
  { from: "#4a4f55", to: "#141516", glow: "#d4d8dc", name: "Graphite" },
  { from: "#1e5a4a", to: "#08241d", glow: "#34d399", name: "Pine" },
  { from: "#2a5a7a", to: "#0b2233", glow: "#22d3ee", name: "Lagoon" },
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
              ? { background: `${glow}`, borderColor: glow, boxShadow: `0 0 8px ${glow}99`, transitionDelay: `${i * 25}ms` }
              : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }
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
  onDelete,
}: {
  binder: Binder;
  value: number | null;
  completion: number; // 0..1 of the catalog this binder holds (unique)
  onDelete?: () => void;
}) {
  const cover = coverFor(binder.id);
  const l = BINDER_LAYOUTS.find((x) => x.id === binder.layout) ?? BINDER_LAYOUTS[1];
  const perPage = l.cols * l.rows;
  const fill = binder.totalQty / Math.max(1, perPage * binder.pageCount);

  return (
    <div className="group relative [perspective:900px]">
      <Link
        href={`/binder/${binder.id}`}
        className="relative flex aspect-[5/6] animate-card-in overflow-hidden rounded-r-2xl rounded-l-md border border-white/10 transition duration-300 [transform-style:preserve-3d] hover:-translate-y-2 hover:[transform:rotateY(-9deg)_translateY(-8px)] sm:aspect-[4/5]"
        style={{
          background: `linear-gradient(145deg, ${cover.from}, ${cover.to})`,
          boxShadow: `0 18px 40px -22px ${cover.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
        }}
      >
        {/* spine with the rings */}
        <span className="relative flex w-9 shrink-0 flex-col items-center justify-evenly bg-black/35 py-4 shadow-[inset_-6px_0_10px_-6px_rgba(0,0,0,0.6)]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-4 w-6 rounded-full border-2 border-white/40 bg-gradient-to-b from-white/50 to-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            />
          ))}
        </span>

        <span className="relative flex min-w-0 flex-1 flex-col p-4">
          {/* leather grain + shine */}
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.6px)", backgroundSize: "4px 4px" }}
          />
          <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60" style={{ background: cover.glow }} />

          <span className="relative flex items-start justify-between gap-2">
            <span className="rounded-md bg-black/40 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-white/80">
              {l.label}
            </span>
            <span className="rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/70">{binder.pageCount} pages</span>
          </span>

          {/* embossed name plate */}
          <span className="relative my-auto py-3">
            <span
              className="block rounded-lg border border-white/20 bg-black/30 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-[2px]"
              style={{ boxShadow: `0 0 24px -8px ${cover.glow}` }}
            >
              <span className="block break-words font-display text-xl font-bold uppercase leading-tight tracking-wide text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]">
                {binder.name}
              </span>
            </span>
          </span>

          <span className="relative flex items-end gap-3">
            <span className="w-14 shrink-0">
              <PocketGrid layout={binder.layout} fill={fill} glow={cover.glow} />
            </span>
            <span className="min-w-0 flex-1 text-right">
              {value !== null && (
                <span className="block font-display text-2xl font-bold leading-none text-white [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">
                  ≈ {formatEur(value)}
                </span>
              )}
              <span className="mt-1 block text-[11px] text-white/65">
                {binder.uniqueCount} unique · {binder.totalQty} copies
              </span>
            </span>
          </span>

          <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-black/40">
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, completion * 100)}%`, background: `linear-gradient(90deg, ${cover.glow}, #fff)` }}
            />
          </span>
        </span>
      </Link>

      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete binder"
          className="absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur transition hover:bg-brand-red hover:text-white md:opacity-0 md:group-hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
