"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

// A Cardmarket wants list ready to paste into Cardmarket → Wants → Add Deck List.
export function WantsModal({
  title,
  text,
  fileName,
  intro,
  onClose,
  children,
}: {
  title: string;
  text: string;
  fileName: string;
  intro: string;
  onClose: () => void;
  children?: React.ReactNode; // extra options (checkboxes)
}) {
  const [copied, setCopied] = useState(false);
  const count = text.trim() ? text.trim().split("\n").reduce((n, l) => n + (parseInt(l, 10) || 0), 0) : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked - the text is selectable
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/[^\w\-]+/g, "_") || "wants"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = "rounded-md px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide";
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="mb-2 text-xs text-white/55">{intro}</p>
      {children}
      <textarea
        readOnly
        value={text.trim() ? text : "Nothing missing - you have everything."}
        spellCheck={false}
        className="h-64 w-full resize-none rounded-md border border-white/10 bg-ink p-3 font-mono text-xs text-white outline-none"
      />
      <p className="mt-1 text-[11px] text-white/40">{count} card{count === 1 ? "" : "s"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} disabled={!text.trim()} className={`${btn} bg-brand-gold text-ink disabled:opacity-40`}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={download} disabled={!text.trim()} className={`${btn} border border-white/20 text-white/80 disabled:opacity-40`}>
          Download .txt
        </button>
        <a
          href="https://www.cardmarket.com/en/Riftbound/Wants"
          target="_blank"
          rel="noreferrer"
          className={`${btn} border border-white/20 text-white/80 hover:bg-white/5`}
        >
          Open Cardmarket wants ↗
        </a>
        <button type="button" onClick={onClose} className={`${btn} text-white/60`}>
          Close
        </button>
      </div>
      <p className="mt-3 text-[11px] text-white/35">
        On Cardmarket: Wants → create or open a list → “Add Deck List” → paste. Regular versions only (no foil, alt art or overnumbered).
      </p>
    </BottomSheet>
  );
}
