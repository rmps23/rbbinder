"use client";

import type { SetInfo } from "@/lib/types";
import { DOMAIN_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS } from "@/lib/constants";
import { domainColor } from "@/lib/style";

export type AltArtFilter = "all" | "hide" | "only";

export type FilterState = {
  search: string;
  setId: string;
  typeId: string;
  rarityId: string;
  domainId: string;
  altArt: AltArtFilter;
  onlyOwned: boolean;
};

export function Filters({
  sets,
  state,
  onChange,
  onlyOwnedLabel,
}: {
  sets: SetInfo[];
  state: FilterState;
  onChange: (next: FilterState) => void;
  onlyOwnedLabel?: string;
}) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...state, [key]: value });
  }

  const selectClass =
    "rounded-md border border-white/10 bg-panel px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-brand-gold";

  return (
    <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-panel/70 p-3 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search card..."
          value={state.search}
          onChange={(e) => set("search", e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none transition focus:border-brand-gold focus:shadow-[0_0_0_3px_rgba(216,171,82,0.15)]"
        />
        <select className={selectClass} value={state.setId} onChange={(e) => set("setId", e.target.value)}>
          <option value="">All sets</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={state.typeId} onChange={(e) => set("typeId", e.target.value)}>
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={state.rarityId} onChange={(e) => set("rarityId", e.target.value)}>
          <option value="">All rarities</option>
          {RARITY_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={state.altArt}
          onChange={(e) => set("altArt", e.target.value as AltArtFilter)}
        >
          <option value="all">All versions</option>
          <option value="hide">Hide alternate arts</option>
          <option value="only">Alternate arts only</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DOMAIN_OPTIONS.map((d) => {
          const on = state.domainId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => set("domainId", on ? "" : d.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                on ? "text-ink" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
              style={on ? { background: domainColor(d.id) } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: domainColor(d.id) }} />
              {d.label}
            </button>
          );
        })}
      </div>
      {onlyOwnedLabel && (
        <label className="flex w-fit items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={state.onlyOwned}
            onChange={(e) => set("onlyOwned", e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink accent-brand-gold"
          />
          {onlyOwnedLabel}
        </label>
      )}
    </div>
  );
}
