"use client";

import { SlideGroup } from "@/components/SlideGroup";
import { BindersSkeleton } from "@/components/Skeletons";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { BinderCard } from "@/components/BinderCard";
import { Select } from "@/components/Select";
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

  if (appLoading || loading) return <BindersSkeleton />;

  const copies = binders.reduce((n, b) => n + b.totalQty, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-t1">Binders</h1>
          <p className="mt-1 text-sm text-t3">
            {binders.length} binder{binders.length === 1 ? "" : "s"} · {copies} cards placed
            {values ? ` · ${formatEur(values.total)}` : ""}
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="btn-3d min-h-11 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide"
        >
          {creating ? "Close" : "+ New binder"}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="mb-6 animate-card-in rounded-xl border border-line bg-panel p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-[220px] flex-[2] flex-col gap-1.5">
              <span className="label">Name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main collection"
                className="h-12 rounded-lg border border-line bg-ink px-3.5 text-sm text-t1 outline-none transition placeholder:text-t3 focus:border-brand-gold"
              />
            </label>

            <div role="radiogroup" aria-label="Pockets per page" className="flex flex-col gap-1.5">
              <span className="label">Pockets per page</span>
              <SlideGroup className="flex h-12 items-stretch rounded-lg border border-line bg-ink p-1">
                {BINDER_LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    data-active={layout === l.id}
                    aria-checked={layout === l.id}
                    onClick={() => setLayout(l.id)}
                    className={`rounded-md px-4 text-sm font-semibold transition ${
                      layout === l.id ? "text-on-accent" : "text-t2 hover:text-t1"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </SlideGroup>
            </div>

            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <span className="label">Collecting a set?</span>
              <Select
                value={setId}
                onChange={setSetId}
                ariaLabel="Set this binder collects"
                searchPlaceholder="Search sets…"
                className="h-12 text-sm"
                options={[{ value: "", label: "No set" }, ...sets.map((s) => ({ value: s.id, label: s.name, hint: s.id }))]}
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-3d h-12 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create
            </button>
          </div>
          {setId && (
            <p className="mt-3 text-xs text-t3">Progress counts one of each regular card. Alt arts, overnumbered and showcase cards don&apos;t count.</p>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-bad">✕ {error}</p>}
        </form>
      )}

      {binders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
                    <p className="mt-3 text-t3">No binders yet - create your first one!</p>
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
