"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppData } from "@/components/AppDataProvider";

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#14171f] p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { cards, sets, collection, loading } = useAppData();

  const stats = useMemo(() => {
    let binderCopies = 0;
    let bulkCopies = 0;
    let uniqueOwned = 0;
    for (const c of cards) {
      const entry = collection[c.id];
      if (!entry) continue;
      binderCopies += entry.binder;
      bulkCopies += entry.bulk;
      if (entry.binder > 0 || entry.bulk > 0) uniqueOwned += 1;
    }
    const perSet = sets.map((s) => {
      const setCards = cards.filter((c) => c.set.id === s.id);
      const owned = setCards.filter((c) => (collection[c.id]?.binder ?? 0) > 0).length;
      return { ...s, owned };
    });
    return { binderCopies, bulkCopies, uniqueOwned, perSet };
  }, [cards, sets, collection]);

  if (loading) {
    return <p className="py-10 text-center text-white/40">A carregar coleção...</p>;
  }

  const completionPct = cards.length ? Math.round((stats.uniqueOwned / cards.length) * 100) : 0;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Dashboard</h1>
      <p className="mb-5 text-sm text-white/50">Resumo da tua coleção Riftbound TCG.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cartas no binder" value={stats.binderCopies} accent="text-amber-400" />
        <StatCard label="Cartas em bulk" value={stats.bulkCopies} accent="text-sky-400" />
        <StatCard label="Cartas únicas" value={`${stats.uniqueOwned} / ${cards.length}`} />
        <StatCard label="Completude" value={`${completionPct}%`} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/binder"
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
        >
          Ir para o Binder
        </Link>
        <Link
          href="/bulk"
          className="rounded-md border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/20"
        >
          Ir para o Bulk
        </Link>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">Por set</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.perSet.map((s) => {
          const pct = s.cardCount ? Math.round((s.owned / s.cardCount) * 100) : 0;
          return (
            <div key={s.id} className="rounded-lg border border-white/10 bg-[#14171f] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-white">{s.name}</p>
                <p className="text-xs text-white/40">
                  {s.owned}/{s.cardCount}
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
