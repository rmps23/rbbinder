"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import type { CardsSyncResult } from "@/lib/types";

type Updated = Record<string, string | null>;

type Job = {
  id: string;
  icon: React.ReactNode;
  title: string;
  what: string;
  when: string;
  button: string;
  stamp?: string; // key in the "last updated" data
  run: () => Promise<string>;
};

const LAST_KEY = "rbbinder:lastRun";

function ago(iso: string | null | undefined) {
  if (!iso) return "never";
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
  // When each job last finished OK from this browser (the server only stamps three of them).
  const [localRuns, setLocalRuns] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setLocalRuns(JSON.parse(localStorage.getItem(LAST_KEY) ?? "{}"));
    } catch {
      // no storage
    }
  }, []);

  function markRun(id: string) {
    setLocalRuns((cur) => {
      const next = { ...cur, [id]: new Date().toISOString() };
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(next));
      } catch {
        // not remembered
      }
      return next;
    });
  }

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
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9H7ZM12 11v6m0 0-2.5-2.5M12 17l2.5-2.5" /></svg>,
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
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3.5 3.5 0 0 0-5.7-1M9 14.5a3.5 3.5 0 0 0 5.7 1M7.5 11h6M7.5 13h6" /></svg>,
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
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
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
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>,
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
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r="1.2" /><circle cx="12" cy="7.5" r="1.2" /><circle cx="15.5" cy="10" r="1.2" /><path d="M12 21a2.5 2.5 0 0 1 0-5h1.5a2 2 0 0 0 2-2" /></svg>,
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
        markRun(job.id);
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
    setResults((r) => {
      const { [job.id]: _drop, ...rest } = r;
      return rest;
    });
    try {
      const text = await job.run();
      markRun(job.id);
      setResults((r) => ({ ...r, [job.id]: { ok: true, text } }));
    } catch (err) {
      setResults((r) => ({ ...r, [job.id]: { ok: false, text: err instanceof Error ? err.message : "Update failed" } }));
    } finally {
      setBusy(null);
    }
  }

  const spinner = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4 animate-spin" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
  const lastOf = (job: Job) => (job.stamp ? updated[job.stamp] : null) ?? localRuns[job.id] ?? null;
  const anyBusy = busy !== null;
  const stepState = (id: string, i: number) => {
    const res = results[id];
    if (res) return res.ok ? "done" : "failed";
    return all && all.step === i && busy === "all" ? "running" : "waiting";
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-t1">Data &amp; updates</h1>
        <p className="mt-1 text-sm text-t3">Keep the card data, links and prices in step with the game.</p>
      </header>

      {/* update everything */}
      <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <h2 className="font-display text-lg font-semibold text-t1">Update everything</h2>
            <p className="mt-1 text-sm text-t2">Runs the five updates below in the right order. It stops at the first one that fails.</p>
          </div>
          <button
            onClick={runAll}
            disabled={anyBusy}
            className="btn-3d inline-flex h-12 items-center gap-2 rounded-lg px-8 font-display text-sm font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "all" && spinner}
            {busy === "all" ? "Updating…" : "Update all"}
          </button>
        </div>

        {/* progress timeline */}
        <ol className="mt-6 flex items-start" aria-label="Update steps">
          {ORDER.map((id, i) => {
            const j = jobs.find((x) => x.id === id)!;
            const state = stepState(id, i);
            const tone =
              state === "done" ? "border-ok bg-ok text-on-accent" : state === "failed" ? "border-bad bg-bad text-on-accent" : state === "running" ? "border-brand-gold text-brand-gold" : "border-line2 text-t3";
            return (
              <li key={id} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${stepState(ORDER[i - 1], i - 1) === "done" ? "bg-ok" : "bg-cavity"}`}
                  />
                )}
                <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-panel text-xs font-bold ${tone} ${state === "done" || state === "failed" ? "" : ""}`} aria-hidden="true">
                  {state === "done" ? "✓" : state === "failed" ? "!" : state === "running" ? spinner : i + 1}
                </span>
                <span className={`mt-2 px-1 text-[11px] font-semibold leading-tight ${state === "waiting" ? "text-t3" : "text-t1"}`}>
                  {j.button}
                  <span className="sr-only"> - {state}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {all?.done && <p role="status" className="mt-4 text-sm font-semibold text-ok">✓ Everything is up to date.</p>}
        {all?.failed && (
          <p role="alert" className="mt-4 text-sm font-semibold text-bad">
            ✕ Stopped at “{all.failed}” - see its message below, fix it and run again.
          </p>
        )}
      </section>

      {/* single updates */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <h2 className="border-b border-line px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1 sm:px-5">Updates one by one</h2>
        <ul className="divide-y divide-line">
          {jobs.map((job) => {
            const result = results[job.id];
            const working = busy === job.id;
            const last = lastOf(job);
            return (
              <li key={job.id} className="px-4 py-4 sm:px-5">
                <div className="grid items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                  <span className="hidden h-11 w-11 items-center justify-center rounded-xl border border-line bg-ink text-brand-gold sm:flex">{job.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold leading-tight text-t1">{job.title}</h3>
                    <p className="mt-1 text-sm leading-snug text-t2">{job.what}</p>
                    <p className="mt-1.5 text-xs text-t3">
                      <b className="font-semibold text-t2">When:</b> {job.when}
                    </p>
                  </div>
                  <span
                    className={`inline-flex h-8 w-fit shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
                      last ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-ink text-t3"
                    }`}
                    title={last ? `Last run ${new Date(last).toLocaleString()}` : "Never run here: the built-in data is in use"}
                  >
                    <span className={`h-2 w-2 rounded-full ${last ? "bg-ok" : "bg-t3"}`} aria-hidden="true" />
                    <span className="num">{last ? ago(last) : "Never run"}</span>
                  </span>
                  <button
                    onClick={() => run(job)}
                    disabled={anyBusy}
                    className="inline-flex h-11 min-w-[9.5rem] items-center justify-center gap-2 rounded-lg border border-line bg-ink px-4 font-display text-xs font-semibold uppercase tracking-wide text-t1 transition hover:border-brand-gold hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-t1"
                  >
                    {working && spinner}
                    {working ? "Working…" : job.button}
                  </button>
                </div>
                {working && (
                  <p role="status" className="mt-3 rounded-lg bg-cavity px-3 py-2 text-sm text-t2">
                    Working… this can take up to half a minute.
                  </p>
                )}
                {result && !working && (
                  <p role={result.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>
                    {result.ok ? "✓ " : "✕ "}
                    {result.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
