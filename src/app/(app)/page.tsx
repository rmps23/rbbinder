"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { BINDER_LAYOUTS } from "@/lib/constants";
import type { Binder, BinderLayout, CardsSyncResult } from "@/lib/types";

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-panel p-5">
      <p className="font-display text-3xl font-bold text-white">
        <span className={accent}>{value}</span>
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { cards, bulk, loading: appLoading, reloadCards } = useAppData();

  const [binders, setBinders] = useState<Binder[]>([]);
  const [bindersLoading, setBindersLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLayout, setNewLayout] = useState<BinderLayout>("3x3");
  const [createError, setCreateError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadBinders = useCallback(async () => {
    setBindersLoading(true);
    const res = await fetch("/api/binders");
    if (res.ok) setBinders(await res.json());
    setBindersLoading(false);
  }, []);

  useEffect(() => {
    loadBinders();
  }, [loadBinders]);

  async function createBinder(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreateError(null);
    const res = await fetch("/api/binders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, layout: newLayout }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error ?? "Couldn't create the binder.");
      return;
    }
    setNewName("");
    setCreating(false);
    router.push(`/binder/${data.id}`);
  }

  async function deleteBinder(binder: Binder) {
    if (!confirm(`Delete binder "${binder.name}"? This action cannot be undone.`)) return;
    await fetch(`/api/binders/${binder.id}`, { method: "DELETE" });
    loadBinders();
  }

  async function syncCards() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/cards/sync", { method: "POST" });
      const data = (await res.json()) as CardsSyncResult | { error: string };
      if (!res.ok || !("ok" in data)) {
        throw new Error("error" in data ? data.error : "Failed to sync");
      }
      const parts = [`+${data.newCards} new card${data.newCards === 1 ? "" : "s"}`];
      if (data.newSets.length) parts.push(`new set(s): ${data.newSets.join(", ")}`);
      parts.push(`${data.totalCards} cards total`);
      setSyncResult(parts.join(" · "));
      if (data.newCards > 0) reloadCards();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  const bulkValues = Object.values(bulk);
  const bulkTotal = bulkValues.reduce((sum, entry) => sum + entry.normal + entry.foil, 0);
  const bulkUnique = bulkValues.filter((entry) => entry.normal > 0 || entry.foil > 0).length;

  if (appLoading || bindersLoading) {
    return <p className="py-10 text-center text-white/40">Loading collection...</p>;
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold uppercase tracking-wide text-white">Dashboard</h1>
      <p className="mb-5 text-sm text-white/50">Your Riftbound TCG collection binders.</p>

      {cards.length === 0 && (
        <div className="mb-5 rounded-lg border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm text-brand-goldSoft">
          There are no cards in the database yet. Click &quot;Sync cards&quot; to fetch the official catalog before
          creating binders.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cards in catalog" value={cards.length} accent="text-white" />
        <StatCard label="Binders created" value={binders.length} accent="text-brand-gold" />
        <StatCard label="Cards in bulk" value={bulkTotal} accent="text-brand-cyan" />
        <Link href="/bulk" className="block">
          <StatCard label="Bulk · unique cards" value={bulkUnique} accent="text-brand-gold" />
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-full border-[1.5px] border-brand-gold px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-brand-gold hover:bg-brand-gold/10"
        >
          + New binder
        </button>
        <button
          onClick={syncCards}
          disabled={syncing}
          className="rounded-full bg-brand-gold px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft disabled:cursor-wait disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync cards"}
        </button>
        {syncResult && <span className="text-sm text-emerald-300">{syncResult}</span>}
        {syncError && <span className="text-sm text-red-300">{syncError}</span>}
      </div>

      {creating && (
        <form
          onSubmit={createBinder}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-panel/60 p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Binder name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Main collection"
              className="min-w-[220px] rounded-md border border-white/10 bg-ink px-3 py-1.5 text-sm text-white outline-none focus:border-brand-gold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Layout</label>
            <select
              value={newLayout}
              onChange={(e) => setNewLayout(e.target.value as BinderLayout)}
              className="rounded-md border border-white/10 bg-panel px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-brand-gold"
            >
              {BINDER_LAYOUTS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand-gold px-5 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft"
          >
            Create
          </button>
          {createError && <span className="text-sm text-red-300">{createError}</span>}
        </form>
      )}

      <div className="mb-3 mt-8 flex items-center gap-3">
        <span className="inline-block h-5 w-1 rounded-sm bg-brand-gold" />
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">Your binders</h2>
      </div>
      {binders.length === 0 ? (
        <p className="py-10 text-center text-white/40">
          You haven&apos;t created any binders yet. Use the &quot;+ New binder&quot; button above.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {binders.map((b) => {
            const pct = cards.length ? Math.round((b.uniqueCount / cards.length) * 100) : 0;
            return (
              <div
                key={b.id}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-panel p-5"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
                  style={{ background: "linear-gradient(180deg, rgba(216,171,82,0.14), transparent 70%)" }}
                />
                <Link href={`/binder/${b.id}`} className="relative block">
                  <div className="mb-3 flex items-start justify-between pr-6">
                    <p className="font-display text-lg font-semibold text-white">{b.name}</p>
                    <span className="rounded-md bg-brand-gold px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
                      {b.layout}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-white/40">
                    {b.uniqueCount} unique · {b.totalQty} copies
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand-gold" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
                <button
                  onClick={() => deleteBinder(b)}
                  title="Delete binder"
                  className="absolute right-4 top-4 text-white/30 opacity-0 transition hover:text-brand-red group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
