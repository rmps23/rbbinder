"use client";

import { ListSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/AppDataProvider";
import { MetaDecksModal } from "@/components/MetaDecksModal";
import { DeckTextModal } from "@/components/DeckTextModal";
import { CardArt } from "@/components/DeckViews";
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
  const [metaOpen, setMetaOpen] = useState(false);

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

  if (loading || fetching) return <ListSkeleton label="Loading decks" />;

  const ghost =
    "inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-t2 transition hover:border-line2 hover:bg-panel2 hover:text-t1";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Decks</h1>
          <p className="num mt-1 text-sm text-t3">
            {decks.length} deck{decks.length === 1 ? "" : "s"} · see which cards you already have in bulk
          </p>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create(name);
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Deck name"
          placeholder="Deck name"
          className="h-11 min-w-[220px] flex-1 rounded-lg border border-line bg-ink px-3.5 text-sm text-t1 placeholder:text-t3"
        />
        <button type="submit" className="btn-3d h-11 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide">
          + New deck
        </button>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <button type="button" onClick={() => setImporting(true)} className={ghost}>
          Import
        </button>
        <button type="button" onClick={() => setMetaOpen(true)} className={ghost}>
          Meta decks
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
          ✕ {error}
        </p>
      )}

      {decks.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-line2 py-16 text-center">
          <p className="text-t2">No decks yet.</p>
          <p className="mt-1 text-sm text-t3">Name one above, import a list, or browse the meta decks.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {decks.map((d) => {
            const legend = d.entries.find((e) => e.zone === "legend");
            const legendCard = legend && cardById.get(legend.cardId);
            const count = d.entries.reduce((n, e) => n + (e.zone === "main" || e.zone === "champion" ? e.qty : 0), 0);
            const full = count >= 40;
            return (
              <li key={d.id} className="group relative">
                <Link
                  href={`/decks/${d.id}`}
                  className="flex h-full items-center gap-4 rounded-xl border border-line bg-panel p-4 transition hover:border-line2 hover:bg-panel2"
                >
                  {legendCard ? (
                    <CardArt card={legendCard} sizes="120px" quality={90} className="w-20 shrink-0 rounded-lg" />
                  ) : (
                    <div className="flex aspect-[744/1039] w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-line2 text-2xl text-t3">+</div>
                  )}
                  <span className="min-w-0 flex-1 pr-8">
                    <span className="block truncate font-display text-lg font-semibold leading-tight text-t1">{d.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-t2">{legendCard ? displayName(legendCard) : "No legend yet"}</span>

                    <span className="mt-3 flex items-center justify-between text-xs">
                      <span className={`num font-semibold ${full ? "text-ok" : "text-t2"}`}>
                        {full ? "✓ " : ""}
                        {count}/40 cards
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-sm bg-cavity">
                      <span className={`block h-full rounded-sm ${full ? "bg-ok" : "bg-brand-gold"}`} style={{ width: `${Math.min(100, (count / 40) * 100)}%` }} />
                    </span>

                    <span className="mt-2 block text-[11px] text-t3">
                      {new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  aria-label={`Delete ${d.name}`}
                  title="Delete deck"
                  className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-t3 transition hover:bg-bad/10 hover:text-bad md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {metaOpen && <MetaDecksModal onClose={() => setMetaOpen(false)} />}

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
