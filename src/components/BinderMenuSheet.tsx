"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { BINDER_LAYOUTS } from "@/lib/constants";
import type { BinderLayout } from "@/lib/types";

const row =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] font-display text-sm font-semibold uppercase tracking-wide text-white/80 transition active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30";

export function BinderMenuSheet({
  layout,
  onLayout,
  page,
  totalPages,
  onGoTo,
  canRemovePage,
  onAddPage,
  onRemovePage,
  onRename,
  onDelete,
  onClose,
}: {
  layout: BinderLayout;
  onLayout: (layout: BinderLayout) => void;
  page: number;
  totalPages: number;
  onGoTo: (page: number) => void;
  canRemovePage: boolean;
  onAddPage: () => void;
  onRemovePage: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(String(page));

  function submitGoTo(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.min(totalPages, Math.max(1, Math.round(Number(target) || page)));
    onGoTo(n);
    onClose();
  }

  const label = "mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-white/40 first:mt-0";

  return (
    <BottomSheet title="Binder" onClose={onClose}>
      <p className={label}>Go to page</p>
      <form onSubmit={submitGoTo} className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onGoTo(1);
            onClose();
          }}
          className="h-12 shrink-0 rounded-xl border border-white/10 px-4 text-sm text-white/70 active:bg-white/10"
        >
          First
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="Page number"
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink px-3 text-center text-lg tabular-nums text-white outline-none focus:border-brand-gold"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-brand-gold px-5 font-display text-sm font-semibold uppercase tracking-wide text-ink active:bg-brand-goldSoft"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => {
            onGoTo(totalPages);
            onClose();
          }}
          className="h-12 shrink-0 rounded-xl border border-white/10 px-4 text-sm text-white/70 active:bg-white/10"
        >
          Last
        </button>
      </form>

      <p className={label}>Layout</p>
      <div className="grid grid-cols-4 gap-2">
        {BINDER_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              onLayout(l.id);
              onClose();
            }}
            className={`h-12 rounded-xl font-display text-sm font-semibold uppercase tracking-wide transition ${
              layout === l.id ? "bg-brand-gold text-ink" : "border border-white/10 text-white/70 active:bg-white/10"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className={label}>Pages</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            onAddPage();
            onClose();
          }}
          className={row}
        >
          + Add page
        </button>
        <button
          type="button"
          disabled={!canRemovePage}
          onClick={() => {
            onRemovePage();
            onClose();
          }}
          className={row}
        >
          − Remove last
        </button>
      </div>

      <p className={label}>Binder</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            onClose();
            onRename();
          }}
          className={row}
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete();
          }}
          className={`${row} !border-brand-red/40 !bg-brand-red/10 !text-brand-red`}
        >
          Delete
        </button>
      </div>
    </BottomSheet>
  );
}
