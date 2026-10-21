"use client";

import { useState } from "react";
import type { SetInfo } from "@/lib/types";
import { DOMAIN_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS } from "@/lib/constants";
import { domainColor, rarityColor } from "@/lib/style";

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

const TYPE_ICON: Record<string, string> = { unit: "⚔", spell: "✦", gear: "⚙", legend: "♛", battlefield: "⛰", rune: "◈" };

// A small round/square button that lights up when selected.
function Orb({
  on,
  onClick,
  label,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition duration-150 hover:-translate-y-0.5 active:scale-90 ${
        on ? "scale-110" : "border-transparent opacity-60 hover:opacity-100"
      }`}
      style={on ? { borderColor: color, boxShadow: `0 0 16px -2px ${color}`, background: `${color}33` } : undefined}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">{label}</span>
      <div className="flex items-center gap-0.5 rounded-full bg-white/[0.04] p-0.5">{children}</div>
    </div>
  );
}

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
  const toggle = <K extends "typeId" | "rarityId" | "domainId">(key: K, value: string) =>
    set(key, (state[key] === value ? "" : value) as FilterState[K]);

  const active =
    (state.typeId ? 1 : 0) + (state.rarityId ? 1 : 0) + (state.domainId ? 1 : 0) + (state.altArt !== "all" ? 1 : 0);

  const tab = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider transition active:scale-95 ${
      on
        ? "bg-brand-gold text-ink shadow-[0_0_18px_-4px_rgb(var(--accent)/0.9)]"
        : "text-white/55 hover:bg-white/[0.07] hover:text-white"
    }`;

  return (
    <div className="mb-5 flex flex-col gap-3">
      {/* sets as tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-white/[0.07] bg-panel/80 p-1 backdrop-blur">
        <button type="button" className={tab(!state.setId)} onClick={() => set("setId", "")}>
          All sets
        </button>
        {sets.map((s) => (
          <button key={s.id} type="button" title={s.name} className={tab(state.setId === s.id)} onClick={() => set("setId", state.setId === s.id ? "" : s.id)}>
            {s.id}
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl border border-white/[0.07] bg-panel/70 p-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="relative min-w-[200px] flex-1 self-end">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or code…"
              value={state.search}
              onChange={(e) => set("search", e.target.value)}
              className="h-11 w-full rounded-full border border-white/10 bg-ink pl-10 pr-10 text-sm text-white outline-none transition focus:border-brand-gold focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.15)]"
            />
            {state.search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => set("search", "")}
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition active:scale-95 md:hidden ${
              active ? "border-brand-gold/50 text-brand-gold" : "border-white/10 text-white/60"
            }`}
          >
            Filters
            {active > 0 && <span className="rounded-full bg-brand-gold px-1.5 text-[10px] text-ink">{active}</span>}
          </button>

          <div className={`${open ? "flex" : "hidden"} w-full flex-wrap items-end gap-x-4 gap-y-3 md:flex md:w-auto`}>
            <Group label="Domain">
              {DOMAIN_OPTIONS.map((d) => (
                <Orb key={d.id} on={state.domainId === d.id} onClick={() => toggle("domainId", d.id)} label={d.label} color={domainColor(d.id)}>
                  <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40" style={{ background: domainColor(d.id) }} />
                </Orb>
              ))}
            </Group>
            <Group label="Rarity">
              {RARITY_OPTIONS.map((r) => (
                <Orb key={r.id} on={state.rarityId === r.id} onClick={() => toggle("rarityId", r.id)} label={r.label} color={rarityColor(r.id)}>
                  <span className="h-3 w-3 rotate-45 rounded-[3px] ring-1 ring-black/40" style={{ background: rarityColor(r.id) }} />
                </Orb>
              ))}
            </Group>
            <Group label="Type">
              {TYPE_OPTIONS.map((t) => (
                <Orb key={t.id} on={state.typeId === t.id} onClick={() => toggle("typeId", t.id)} label={t.label} color="rgb(var(--accent))">
                  <span className="text-sm text-white/85">{TYPE_ICON[t.id] ?? "•"}</span>
                </Orb>
              ))}
            </Group>
            <Group label="Art">
              {(
                [
                  ["all", "All"],
                  ["hide", "Regular"],
                  ["only", "Alt art"],
                ] as [AltArtFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("altArt", id)}
                  className={`h-9 rounded-full px-3 text-[11px] font-semibold transition active:scale-95 ${
                    state.altArt === id ? "bg-brand-cyan text-ink" : "text-white/55 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </Group>
            {onlyOwnedLabel && (
              <button
                type="button"
                role="switch"
                aria-checked={state.onlyOwned}
                onClick={() => set("onlyOwned", !state.onlyOwned)}
                className="flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/70 transition hover:border-white/25 active:scale-95"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${state.onlyOwned ? "bg-brand-gold" : "bg-white/15"}`}>
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      state.onlyOwned ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
                {onlyOwnedLabel}
              </button>
            )}
          </div>
        </div>

        {active > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            {state.domainId && <Pill onClear={() => set("domainId", "")}>{DOMAIN_OPTIONS.find((d) => d.id === state.domainId)?.label}</Pill>}
            {state.rarityId && <Pill onClear={() => set("rarityId", "")}>{RARITY_OPTIONS.find((r) => r.id === state.rarityId)?.label}</Pill>}
            {state.typeId && <Pill onClear={() => set("typeId", "")}>{TYPE_OPTIONS.find((t) => t.id === state.typeId)?.label}</Pill>}
            {state.altArt !== "all" && <Pill onClear={() => set("altArt", "all")}>{state.altArt === "only" ? "Alt art" : "Regular art"}</Pill>}
            <button
              type="button"
              onClick={() => onChange({ ...state, typeId: "", rarityId: "", domainId: "", altArt: "all" })}
              className="ml-auto text-xs font-semibold text-brand-red hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="flex items-center gap-1.5 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold transition hover:bg-brand-gold/25 active:scale-95"
    >
      {children} <span className="text-[10px]">✕</span>
    </button>
  );
}
