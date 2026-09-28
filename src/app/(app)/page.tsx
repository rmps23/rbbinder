"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { BINDER_LAYOUTS } from "@/lib/constants";
import type { Binder, BinderLayout, CardsSyncResult } from "@/lib/types";

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#14171f] p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
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
      setCreateError(data.error ?? "Não foi possível criar o binder.");
      return;
    }
    setNewName("");
    setCreating(false);
    router.push(`/binder/${data.id}`);
  }

  async function deleteBinder(binder: Binder) {
    if (!confirm(`Apagar o binder "${binder.name}"? Esta ação não pode ser desfeita.`)) return;
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
        throw new Error("error" in data ? data.error : "Falha ao sincronizar");
      }
      const parts = [`+${data.newCards} carta${data.newCards === 1 ? "" : "s"} nova${data.newCards === 1 ? "" : "s"}`];
      if (data.newSets.length) parts.push(`novo(s) set(s): ${data.newSets.join(", ")}`);
      parts.push(`${data.totalCards} cartas no total`);
      setSyncResult(parts.join(" · "));
      if (data.newCards > 0) reloadCards();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const bulkValues = Object.values(bulk);
  const bulkTotal = bulkValues.reduce((sum, q) => sum + q, 0);
  const bulkUnique = bulkValues.filter((q) => q > 0).length;

  if (appLoading || bindersLoading) {
    return <p className="py-10 text-center text-white/40">A carregar coleção...</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Dashboard</h1>
      <p className="mb-5 text-sm text-white/50">Os teus binders da coleção Riftbound TCG.</p>

      {cards.length === 0 && (
        <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          Ainda não há cartas na base de dados. Clica em &quot;Sincronizar cartas&quot; para ir buscar o catálogo
          oficial antes de criares binders.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cartas no catálogo" value={cards.length} />
        <StatCard label="Binders criados" value={binders.length} accent="text-amber-400" />
        <StatCard label="Cartas em bulk" value={bulkTotal} accent="text-sky-400" />
        <Link href="/bulk" className="block">
          <StatCard label="Bulk · cartas únicas" value={bulkUnique} />
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          + Novo binder
        </button>
        <button
          onClick={syncCards}
          disabled={syncing}
          className="rounded-md border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/20 disabled:cursor-wait disabled:opacity-60"
        >
          {syncing ? "A sincronizar..." : "Sincronizar cartas"}
        </button>
        {syncResult && <span className="text-sm text-emerald-300">{syncResult}</span>}
        {syncError && <span className="text-sm text-red-300">{syncError}</span>}
      </div>

      {creating && (
        <form
          onSubmit={createBinder}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-[#14171f]/60 p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Nome do binder</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Coleção principal"
              className="min-w-[220px] rounded-md border border-white/10 bg-[#0d0f14] px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">Layout</label>
            <select
              value={newLayout}
              onChange={(e) => setNewLayout(e.target.value as BinderLayout)}
              className="rounded-md border border-white/10 bg-[#14171f] px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-amber-400"
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
            className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-amber-300"
          >
            Criar
          </button>
          {createError && <span className="text-sm text-red-300">{createError}</span>}
        </form>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">Os teus binders</h2>
      {binders.length === 0 ? (
        <p className="py-10 text-center text-white/40">
          Ainda não criaste nenhum binder. Usa o botão &quot;+ Novo binder&quot; acima.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {binders.map((b) => {
            const pct = cards.length ? Math.round((b.uniqueCount / cards.length) * 100) : 0;
            return (
              <div key={b.id} className="group relative rounded-lg border border-white/10 bg-[#14171f] p-4">
                <Link href={`/binder/${b.id}`} className="block">
                  <div className="mb-2 flex items-center justify-between pr-6">
                    <p className="font-semibold text-white">{b.name}</p>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                      {b.layout}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-white/40">
                    {b.uniqueCount} únicas · {b.totalQty} cópias
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
                <button
                  onClick={() => deleteBinder(b)}
                  title="Apagar binder"
                  className="absolute right-3 top-3 text-white/30 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
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
