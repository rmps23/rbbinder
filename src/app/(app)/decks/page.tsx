"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { DeckTextModal } from "@/components/DeckTextModal";
import { CardArt, primaryColor } from "@/components/DeckViews";
import { buildDeckIndex, displayName, parseDeck } from "@/lib/deck";
import type { Deck } from "@/lib/types";

export default function DecksPage() {
  const router = useRouter();
  const { cards, loading } = useAppData();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const index = useMemo(() => buildDeckIndex(cards), [cards]);

  const load = useCallback(async () => {
    const res = await fetch("/api/decks");
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setDecks(data);
      setError(null);
    } else setError(data?.error ?? "Couldn't load decks.");
    setFetching(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(deckName: string, entries: Deck["entries"] = []) {
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: deckName.trim() || "New deck", entries }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Couldn't create the deck.");
      return false;
    }
    router.push(`/decks/${data.id}`);
    return true;
  }

  async function remove(deck: Deck) {
    if (!confirm(`Delete deck "${deck.name}"?`)) return;
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    load();
  }

  if (loading || fetching) return <p className="py-10 text-center text-white/40">Loading decks...</p>;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl font-semibold uppercase tracking-wide text-white">Decks</h1>
      <p className="mb-5 text-sm text-white/50">Build decks and see which cards you already have in bulk.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create(name);
        }}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deck name"
          className="min-w-[220px] rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
        />
        <button
          type="submit"
          className="rounded-full bg-brand-gold px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft"
        >
          + New deck
        </button>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="rounded-full border-[1.5px] border-brand-gold px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-brand-gold hover:bg-brand-gold/10"
        >
          Import
        </button>
      </form>

      {error && <p className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

      {decks.length === 0 && !error ? (
        <p className="py-10 text-center text-white/40">No decks yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {decks.map((d) => {
            const legend = d.entries.find((e) => e.zone === "legend");
            const legendCard = legend && cardById.get(legend.cardId);
            const count = d.entries.reduce((n, e) => n + (e.zone === "main" || e.zone === "champion" ? e.qty : 0), 0);
            const color = legendCard ? primaryColor(legendCard) : "rgb(var(--accent))";
            return (
              <div
                key={d.id}
                className="group relative animate-card-in overflow-hidden rounded-2xl border border-white/[0.07] bg-panel transition duration-200 hover:-translate-y-1 hover:border-white/25"
                style={{ boxShadow: `0 14px 36px -22px ${color}` }}
              >
                <span className="absolute inset-x-0 top-0 z-10 h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <Link href={`/decks/${d.id}`} className="flex items-center gap-4 p-4">
                  {legendCard ? (
                    <CardArt card={legendCard} sizes="80px" className="w-16 shrink-0 rounded-lg shadow-lg transition group-hover:scale-105 group-hover:-rotate-2" />
                  ) : (
                    <div className="flex aspect-[744/1039] w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-xl text-white/25">+</div>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate pr-6 font-display text-lg font-semibold text-white">{d.name}</span>
                    <span className="block truncate text-xs text-white/45">
                      {legendCard ? displayName(legendCard) : "No legend yet"}
                    </span>
                    <span className="mt-2 inline-block rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-white/60">
                      {count}/40 cards
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => remove(d)}
                  title="Delete deck"
                  className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center text-white/40 transition hover:text-brand-red md:opacity-0 md:group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {importing && (
        <DeckTextModal
          mode="import"
          onClose={() => setImporting(false)}
          onImport={(text) => {
            const { entries, unknown } = parseDeck(text, index);
            if (!entries.length) return `No cards recognised.${unknown.length ? `\n${unknown.slice(0, 8).join("\n")}` : ""}`;
            create(name || "Imported deck", entries);
            return null;
          }}
        />
      )}
    </div>
  );
}
