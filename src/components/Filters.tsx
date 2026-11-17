"use client";

import { useState } from "react";
import { SlideGroup } from "@/components/SlideGroup";
import { Select } from "@/components/Select";
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

const ART: [AltArtFilter, string][] = [
  ["all", "All"],
  ["hide", "Regular"],
  ["only", "Alt art"],
];

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
  const [open, setOpen] = useState(false);

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...state, [key]: value });
  }

  const active =
    (state.setId ? 1 : 0) +
    (state.typeId ? 1 : 0) +
    (state.rarityId ? 1 : 0) +
    (state.domainId ? 1 : 0) +
    (state.altArt !== "all" ? 1 : 0) +
    (state.search ? 1 : 0);
  const secondary = (state.typeId ? 1 : 0) + (state.rarityId ? 1 : 0) + (state.domainId ? 1 : 0) + (state.altArt !== "all" ? 1 : 0);

  return (
    <div className="mb-5 rounded-xl border border-line bg-panel p-3">
      {/* search + set */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-t3">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            aria-label="Search by name or code"
            placeholder="Search by name or code…"
            value={state.search}
            onChange={(e) => set("search", e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-ink pl-10 pr-10 text-sm text-t1 placeholder:text-t3"
          />
          {state.search && (
            <button type="button" aria-label="Clear search" onClick={() => set("search", "")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-t3 hover:bg-cavity hover:text-t1">
              ✕
            </button>
          )}
        </div>
        <div className="w-48 shrink-0">
          <Select
            value={state.setId}
            onChange={(v) => set("setId", v)}
            ariaLabel="Set"
            searchPlaceholder="Search sets…"
            className="h-11 text-sm"
            menuMinWidth={260}
            options={[{ value: "", label: "All sets" }, ...sets.map((s) => ({ value: s.id, label: s.name, hint: s.id }))]}
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition md:hidden ${secondary ? "border-brand-gold/60 text-brand-gold" : "border-line text-t2"}`}
        >
          Filters
          {secondary > 0 && <span className="num rounded bg-brand-gold px-1.5 text-[11px] font-bold text-on-accent">{secondary}</span>}
        </button>
      </div>

      {/* the rest: always visible on larger screens, behind the Filters button on phones */}
      <div className={`${open ? "flex" : "hidden"} mt-3 flex-col gap-3 border-t border-line pt-3 md:flex`}>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Domain">
          {DOMAIN_OPTIONS.map((d) => {
            const on = state.domainId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => set("domainId", on ? "" : d.id)}
                className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${on ? "border-line2 bg-cavity text-t1" : "border-line text-t2 hover:border-line2 hover:text-t1"}`}
                style={on ? { boxShadow: `inset 0 -2px 0 ${domainColor(d.id)}` } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: domainColor(d.id) }} aria-hidden="true" />
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select
              value={state.rarityId}
              onChange={(v) => set("rarityId", v)}
              searchable={false}
              ariaLabel="Rarity"
              className="h-11 text-sm"
              menuMinWidth={170}
              options={[{ value: "", label: "All rarities" }, ...RARITY_OPTIONS.map((r) => ({ value: r.id, label: r.label }))]}
            />
          </div>
          <div className="w-40">
            <Select
              value={state.typeId}
              onChange={(v) => set("typeId", v)}
              searchable={false}
              ariaLabel="Type"
              className="h-11 text-sm"
              menuMinWidth={170}
              options={[{ value: "", label: "All types" }, ...TYPE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))]}
            />
          </div>
          <SlideGroup role="radiogroup" aria-label="Art" className="flex h-11 items-stretch gap-1 rounded-lg border border-line bg-ink p-1">
            {ART.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={state.altArt === id}
                data-active={state.altArt === id}
                onClick={() => set("altArt", id)}
                className={`rounded-md px-3.5 text-sm font-semibold transition ${state.altArt === id ? "text-on-accent" : "text-t2 hover:text-t1"}`}
              >
                {label}
              </button>
            ))}
          </SlideGroup>
          {onlyOwnedLabel && (
            <button
              type="button"
              role="switch"
              aria-checked={state.onlyOwned}
              onClick={() => set("onlyOwned", !state.onlyOwned)}
              className="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-ink px-4 text-sm font-semibold text-t2 transition hover:border-line2"
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${state.onlyOwned ? "bg-brand-gold" : "bg-cavity"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${state.onlyOwned ? "left-[18px]" : "left-0.5"}`} />
              </span>
              {onlyOwnedLabel}
            </button>
          )}
          {active > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...state, search: "", setId: "", typeId: "", rarityId: "", domainId: "", altArt: "all" })}
              className="ml-auto h-11 rounded-lg px-3 text-sm font-semibold text-brand-gold transition hover:bg-brand-gold/10"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
