"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { useBinderCards } from "@/lib/useBinderCards";
import { Filters, FilterState } from "@/components/Filters";
import { CardTile } from "@/components/CardTile";
import { LayoutSwitcher } from "@/components/LayoutSwitcher";
import { BINDER_LAYOUTS, GRID_COLS_CLASS } from "@/lib/constants";
import type { Binder, BinderLayout } from "@/lib/types";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  setId: "",
  typeId: "",
  rarityId: "",
  domainId: "",
  onlyOwned: false,
};

export default function BinderDetailPage() {
  const params = useParams<{ id: string }>();
  const binderId = params.id;
  const router = useRouter();
  const { cards, sets, loading: cardsLoading } = useAppData();
  const { qty, loading: qtyLoading, setQty } = useBinderCards(binderId);

  const [binder, setBinder] = useState<Binder | null>(null);
  const [binderLoading, setBinderLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBinderLoading(true);
    fetch(`/api/binders/${binderId}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setBinderLoading(false);
        return;
      }
      const data = await res.json();
      setBinder(data);
      setNameDraft(data.name);
      setBinderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [binderId]);

  useEffect(() => {
    setPage(0);
  }, [filters]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return cards.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search) && !c.publicCode.toLowerCase().includes(search)) {
        return false;
      }
      if (filters.setId && c.set.id !== filters.setId) return false;
      if (filters.typeId && !c.types.includes(filters.typeId)) return false;
      if (filters.rarityId && c.rarity?.id !== filters.rarityId) return false;
      if (filters.domainId && !c.domains.some((d) => d.id === filters.domainId)) return false;
      if (filters.onlyOwned && (qty[c.id] ?? 0) <= 0) return false;
      return true;
    });
  }, [cards, filters, qty]);

  const layout = BINDER_LAYOUTS.find((l) => l.id === binder?.layout) ?? BINDER_LAYOUTS[1];
  const perPage = layout.cols * layout.rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageCards = filtered.slice(clampedPage * perPage, clampedPage * perPage + perPage);

  async function changeLayout(newLayout: BinderLayout) {
    setBinder((b) => (b ? { ...b, layout: newLayout } : b));
    setPage(0);
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: newLayout }),
    });
  }

  async function saveName() {
    const name = nameDraft.trim();
    setRenaming(false);
    if (!name || name === binder?.name) {
      setNameDraft(binder?.name ?? "");
      return;
    }
    setBinder((b) => (b ? { ...b, name } : b));
    await fetch(`/api/binders/${binderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteBinder() {
    if (!binder) return;
    if (!confirm(`Apagar o binder "${binder.name}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/binders/${binderId}`, { method: "DELETE" });
    router.push("/");
  }

  if (cardsLoading || binderLoading || qtyLoading) {
    return <p className="py-10 text-center text-white/40">A carregar binder...</p>;
  }

  if (notFound || !binder) {
    return (
      <div className="py-10 text-center">
        <p className="mb-3 text-white/40">Binder não encontrado.</p>
        <Link href="/" className="text-sm font-medium text-amber-400 hover:underline">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setNameDraft(binder.name);
                setRenaming(false);
              }
            }}
            className="rounded-md border border-amber-400/50 bg-[#14171f] px-2 py-1 text-2xl font-bold text-white outline-none"
          />
        ) : (
          <h1
            onClick={() => setRenaming(true)}
            title="Clica para renomear"
            className="cursor-text text-2xl font-bold text-white hover:text-amber-300"
          >
            {binder.name}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <LayoutSwitcher value={binder.layout} onChange={changeLayout} />
          <button
            onClick={deleteBinder}
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/20"
          >
            Apagar binder
          </button>
        </div>
      </div>
      <p className="mb-5 text-sm text-white/50">
        {binder.uniqueCount} cartas únicas · {binder.totalQty} cópias neste binder.
      </p>

      <Filters
        sets={sets}
        state={filters}
        onChange={setFilters}
        onlyOwnedLabel="Mostrar só cartas que já tenho neste binder"
      />

      <p className="mb-3 text-sm text-white/40">
        {filtered.length} carta{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-white/40">Nenhuma carta encontrada com estes filtros.</p>
      ) : (
        <>
          <div className={`grid ${GRID_COLS_CLASS[layout.cols]} gap-3`}>
            {pageCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                qty={qty[card.id] ?? 0}
                onChangeQty={(q) => setQty(card.id, q)}
                accent="amber"
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Página anterior
            </button>
            <span className="text-sm text-white/50">
              Página {clampedPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Próxima página →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
