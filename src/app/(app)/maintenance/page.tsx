"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import type { CardsSyncResult } from "@/lib/types";

type Updated = Record<string, string | null>;

type Job = {
  id: string;
  title: string;
  what: string;
  when: string;
  button: string;
  stamp?: string; // key in the "last updated" data
  run: () => Promise<string>;
};

function ago(iso: string | null | undefined) {
  if (!iso) return "never run here (using the built-in data)";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

export default function MaintenancePage() {
  const { reloadCards, reloadPrices } = useAppData();
  const [updated, setUpdated] = useState<Updated>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});

  useEffect(() => {
    fetch("/api/maintenance")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setUpdated)
      .catch(() => {});
  }, []);

  async function post(task: string) {
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    if (data.updatedAt) setUpdated(data.updatedAt);
    return data.message as string;
  }

  const jobs: Job[] = [
    {
      id: "sync",
      title: "Sync cards",
      what: "Downloads the official card list from Riot: new cards, new sets, and corrections to existing ones.",
      when: "When a new set is announced or released, or a card looks wrong.",
      button: "Sync cards",
      run: async () => {
        const res = await fetch("/api/cards/sync", { method: "POST" });
        const data = (await res.json()) as CardsSyncResult | { error: string };
        if (!res.ok || !("ok" in data)) throw new Error("error" in data ? data.error : "Failed to sync");
        reloadCards();
        const parts = [`+${data.newCards} new card${data.newCards === 1 ? "" : "s"}`];
        if (data.newSets.length) parts.push(`new set(s): ${data.newSets.join(", ")}`);
        parts.push(`${data.totalCards} cards total`);
        return parts.join(" · ");
      },
    },
    {
      id: "prices",
      title: "Refresh prices",
      what: "Fetches today's prices again (Cardmarket trend, TCGplayer where a card isn't linked). They're also cached for a few hours on their own.",
      when: "When you want the very latest numbers.",
      button: "Refresh prices",
      run: async () => {
        const msg = await post("prices");
        reloadPrices();
        return msg;
      },
    },
    {
      id: "cardmarket-links",
      title: "Update Cardmarket links",
      what: "Links each of your cards to its Cardmarket product (needed to read Cardmarket prices). Run after cards are added.",
      when: "After “Sync cards” brings in new cards or a new set.",
      button: "Update links",
      stamp: "cardmarketMap",
      run: async () => {
        const msg = await post("cardmarket-links");
        reloadPrices();
        return msg;
      },
    },
    {
      id: "finishes",
      title: "Update foil / normal availability",
      what: "Checks which cards exist as normal, foil or both, using TCGplayer's product list (cards of unreleased sets keep the default rules).",
      when: "After a set is released.",
      button: "Update finishes",
      stamp: "finishes",
      run: async () => {
        const msg = await post("finishes");
        reloadCards();
        reloadPrices();
        return msg;
      },
    },
    {
      id: "domains",
      title: "Fix domains of unreleased sets",
      what: "Riot's data for sets that aren't out yet often has wrong or missing domains. This corrects them from TCGplayer, which the deck rules rely on.",
      when: "While a set is unreleased. Once it's out, run it again - the fixes then drop away.",
      button: "Update domains",
      stamp: "domainFixes",
      run: async () => {
        const msg = await post("domains");
        reloadCards();
        return msg;
      },
    },
  ];

  // Everything, in the order that makes sense: cards first, then what depends on them.
  const ORDER = ["sync", "domains", "finishes", "cardmarket-links", "prices"];
  const [all, setAll] = useState<{ step: number; failed: string | null; done: boolean } | null>(null);

  async function runAll() {
    setBusy("all");
    setAll({ step: 0, failed: null, done: false });
    setResults({});
    for (let i = 0; i < ORDER.length; i++) {
      const job = jobs.find((j) => j.id === ORDER[i])!;
      setAll({ step: i, failed: null, done: false });
      try {
        const text = await job.run();
        setResults((r) => ({ ...r, [job.id]: { ok: true, text } }));
      } catch (err) {
        const text = err instanceof Error ? err.message : "Update failed";
        setResults((r) => ({ ...r, [job.id]: { ok: false, text } }));
        setAll({ step: i, failed: job.title, done: false });
        setBusy(null);
        return;
      }
    }
    setAll({ step: ORDER.length, failed: null, done: true });
    setBusy(null);
  }

  async function run(job: Job) {
    setBusy(job.id);
    setResults((r) => ({ ...r, [job.id]: { ok: true, text: "Working… this can take up to half a minute." } }));
    try {
      const text = await job.run();
      setResults((r) => ({ ...r, [job.id]: { ok: true, text } }));
    } catch (err) {
      setResults((r) => ({ ...r, [job.id]: { ok: false, text: err instanceof Error ? err.message : "Update failed" } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-white">Data &amp; updates</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">Keep the card data, links and prices in step with the game. Each button does one thing.</p>

      <section className="relative mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel p-4 sm:p-5">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-gold via-brand-cyan to-brand-gold" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="font-display text-xl font-semibold text-white">Update everything</h2>
            <p className="mt-1 text-sm text-white/55">
              Runs all five updates below in the right order: cards, domains, finishes, Cardmarket links, prices.
            </p>
          </div>
          <button
            onClick={runAll}
            disabled={busy !== null}
            className="rounded-full bg-brand-gold px-6 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-ink shadow-[0_0_24px_-4px_rgb(var(--accent)/0.8)] transition hover:bg-brand-goldSoft active:scale-95 disabled:cursor-wait disabled:opacity-50"
          >
            {busy === "all" ? "Updating…" : "Update all"}
          </button>
        </div>
        {all && (
          <div className="mt-4">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  all.failed ? "bg-brand-red" : "bg-gradient-to-r from-brand-gold to-brand-cyan"
                } ${busy === "all" ? "animate-pulse" : ""}`}
                style={{ width: `${Math.round(((all.done ? ORDER.length : all.step + (busy === "all" ? 0.5 : 0)) / ORDER.length) * 100)}%` }}
              />
            </div>
            <ol className="mt-3 grid gap-1.5 text-xs sm:grid-cols-5">
              {ORDER.map((id, i) => {
                const j = jobs.find((x) => x.id === id)!;
                const res = results[id];
                const state = res ? (res.ok ? "done" : "failed") : all.step === i && busy === "all" ? "running" : "waiting";
                return (
                  <li
                    key={id}
                    className={`rounded-lg px-2.5 py-2 ${
                      state === "done"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : state === "failed"
                          ? "bg-brand-red/10 text-brand-red"
                          : state === "running"
                            ? "bg-brand-gold/10 text-brand-gold"
                            : "bg-white/[0.04] text-white/40"
                    }`}
                  >
                    {state === "done" ? "✓" : state === "failed" ? "⚠" : state === "running" ? "…" : `${i + 1}.`} {j.title}
                  </li>
                );
              })}
            </ol>
            {all.done && <p className="mt-3 text-sm text-emerald-300">✓ Everything is up to date.</p>}
            {all.failed && <p className="mt-3 text-sm text-brand-red">Stopped at “{all.failed}” - see the message below, fix it and run again.</p>}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3">
        {jobs.map((job) => {
          const result = results[job.id];
          return (
            <section key={job.id} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-4 sm:p-5">
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-gold to-brand-cyan" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <h2 className="font-display text-lg font-semibold text-white">{job.title}</h2>
                  <p className="mt-1 text-sm text-white/55">{job.what}</p>
                  <p className="mt-1 text-xs text-white/35">
                    <b className="text-white/50">When:</b> {job.when}
                    {job.stamp && <> · Last run: {ago(updated[job.stamp])}</>}
                  </p>
                </div>
                <button
                  onClick={() => run(job)}
                  disabled={busy !== null}
                  className="rounded-full bg-brand-gold px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-ink shadow-[0_0_18px_-4px_rgb(var(--accent)/0.7)] transition hover:bg-brand-goldSoft active:scale-95 disabled:cursor-wait disabled:opacity-50"
                >
                  {busy === job.id ? "Working…" : job.button}
                </button>
              </div>
              {result && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-white/[0.04] text-white/70" : "bg-brand-red/10 text-brand-red"}`}>
                  {result.ok ? "✓ " : "⚠ "}
                  {result.text}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
