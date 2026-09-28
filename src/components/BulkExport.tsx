"use client";

import { useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";

export function BulkExport() {
  const { cards, bulk } = useAppData();
  const [copied, setCopied] = useState(false);

  const { list, total, uniqueCount } = useMemo(() => {
    const rows = cards
      .filter((c) => (bulk[c.id] ?? 0) > 0)
      .map((c) => ({ card: c, qty: bulk[c.id] }))
      .sort((a, b) => a.card.name.localeCompare(b.card.name));

    const text = rows.map((r) => `${r.qty}x ${r.card.name} (${r.card.publicCode})`).join("\n");
    const total = rows.reduce((sum, r) => sum + r.qty, 0);
    return { list: text, total, uniqueCount: rows.length };
  }, [cards, bulk]);

  async function copy() {
    if (!list) return;
    await navigator.clipboard.writeText(list);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#14171f]/60 p-3">
      <p className="text-sm text-white/60">
        <span className="font-semibold text-white">{total}</span> cartas bulk ·{" "}
        <span className="font-semibold text-white">{uniqueCount}</span> cartas diferentes
      </p>
      <button
        onClick={copy}
        disabled={!list}
        className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-400/20 disabled:opacity-40"
      >
        {copied ? "Copiado!" : "Copiar lista para trocas"}
      </button>
    </div>
  );
}
