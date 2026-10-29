"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { BinderCard, PocketGrid, COVERS } from "@/components/BinderCard";
import { BINDER_LAYOUTS } from "@/lib/constants";
import { formatEur } from "@/lib/format";
import { binderProgress } from "@/lib/binderProgress";
import { useBinders } from "@/lib/useBinders";
import { valueContents } from "@/lib/valuation";
import type { Binder, BinderLayout } from "@/lib/types";

export default function BindersPage() {
  const router = useRouter();
  const { cards, sets, prices, priceOf, loading: appLoading } = useAppData();
  const { binders, loading, reload } = useBinders();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<BinderLayout>("3x3");
  const [setId, setSetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const values = useMemo(() => {
    if (!prices) return null;
    const byId = new Map(cards.map((c) => [c.id, c]));
    const per = new Map(binders.map((b) => [b.id, valueContents(b.contents, byId, priceOf)]));
    let total = 0;
    for (const v of per.values()) total += v.value;
    return { per, total };
  }, [prices, cards, binders, priceOf]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    const res = await fetch("/api/binders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed, layout, setId: setId || null }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Couldn't create the binder.");
    router.push(`/binder/${data.id}`);
  }

  async function remove(b: Binder) {
    if (!confirm(`Delete binder "${b.name}"? This action cannot be undone.`)) return;
    await fetch(`/api/binders/${b.id}`, { method: "DELETE" });
    reload();
  }

  if (appLoading || loading) return <p className="py-10 text-center text-white/40">Loading binders...</p>;

  const copies = binders.reduce((n, b) => n + b.totalQty, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-white">Binders</h1>
          <p className="mt-1 text-sm text-white/50">
            {binders.length} binder{binders.length === 1 ? "" : "s"} · {copies} cards placed
            {values ? ` · ≈ ${formatEur(values.total)}` : ""}
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-brand-gold px-6 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft active:scale-95"
        >
          {creating ? "Close" : "+ New binder"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={create}
          className="relative mb-8 animate-card-in overflow-hidden rounded-2xl border border-white/[0.08] bg-panel p-4 sm:p-5"
        >
          <div className="grid gap-5 md:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Main collection"
                  className="rounded-xl border border-white/10 bg-ink px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-brand-gold focus:"
                />
              </label>
              <div>
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Pockets per page</span>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {BINDER_LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayout(l.id)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-2.5 transition active:scale-95 ${
                        layout === l.id ? "border-brand-gold bg-brand-gold/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                      }`}
                    >
                      <span className="w-10">
                        <PocketGrid layout={l.id} fill={layout === l.id ? 1 : 0} glow="rgb(var(--accent))" />
                      </span>
                      <span className="text-[11px] font-semibold text-white/70">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Collecting a set?</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[{ id: "", name: "No set" }, ...sets].map((s) => (
                    <button
                      key={s.id || "none"}
                      type="button"
                      onClick={() => setSetId(s.id)}
                      title={s.name}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        setId === s.id ? "border-brand-gold bg-brand-gold text-ink" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30"
                      }`}
                    >
                      {s.id ? `${s.id} · ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-white/35">
                  Progress then counts one of each regular card of the set - alternate arts, overnumbered and showcase cards don&apos;t count.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-md bg-brand-gold px-6 py-2 font-display text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-brand-goldSoft active:scale-95 disabled:opacity-40"
                >
                  Create binder
                </button>
                {error && <span className="text-sm text-red-300">{error}</span>}
              </div>
            </div>
            <div className="hidden w-40 items-center justify-center md:flex">
              <div
                className="flex aspect-[4/5] w-full items-center justify-center rounded-r-xl rounded-l-sm border border-white/10 p-3 text-center font-display text-sm font-bold uppercase text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]"
                style={{ background: `linear-gradient(145deg, ${COVERS[name.length % COVERS.length].from}, ${COVERS[name.length % COVERS.length].to})` }}
              >
                {name.trim() || "Your binder"}
              </div>
            </div>
          </div>
        </form>
      )}

      {binders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
                    <p className="mt-3 text-white/50">No binders yet - create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {binders.map((b) => {
            const p = binderProgress(b, cards, sets);
            return (
              <BinderCard
                key={b.id}
                binder={b}
                value={values ? (values.per.get(b.id)?.value ?? 0) : null}
                completion={p.completion}
                progressLabel={p.label}
                onDelete={() => remove(b)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
