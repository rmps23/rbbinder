"use client";

import type { SetInfo } from "@/lib/types";
import { DOMAIN_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS } from "@/lib/constants";

export type FilterState = {
  search: string;
  setId: string;
  typeId: string;
  rarityId: string;
  domainId: string;
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
    "rounded-md border border-white/10 bg-[#14171f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-amber-400";

  return (
    <div className="mb-4 flex flex-col gap-2.5 rounded-lg border border-white/10 bg-[#14171f]/60 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Pesquisar carta..."
          value={state.search}
          onChange={(e) => set("search", e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-white/10 bg-[#0d0f14] px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400"
        />
        <select className={selectClass} value={state.setId} onChange={(e) => set("setId", e.target.value)}>
          <option value="">Todos os sets</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={state.typeId} onChange={(e) => set("typeId", e.target.value)}>
          <option value="">Todos os tipos</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={state.rarityId} onChange={(e) => set("rarityId", e.target.value)}>
          <option value="">Todas as raridades</option>
          {RARITY_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={state.domainId} onChange={(e) => set("domainId", e.target.value)}>
          <option value="">Todos os domínios</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      {onlyOwnedLabel && (
        <label className="flex w-fit items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={state.onlyOwned}
            onChange={(e) => set("onlyOwned", e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-[#0d0f14] accent-amber-400"
          />
          {onlyOwnedLabel}
        </label>
      )}
    </div>
  );
}
