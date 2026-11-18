"use client";

import { useEffect, useRef, useState } from "react";

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

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const ghost =
    "inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-t1 transition hover:border-line2 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line2 bg-panel outline-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-t1">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-t2 transition hover:border-line2 hover:text-t1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <p className="text-sm text-t2">{intro}</p>
          {children}
          <div>
            <textarea
              readOnly
              value={text.trim() ? text : "Nothing missing - you have everything."}
              spellCheck={false}
              className="h-64 w-full resize-none rounded-lg border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-t1"
            />
            <p className="num mt-1.5 text-xs text-t3">
              <b className="text-t1">{count}</b> card{count === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <footer className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} disabled={!text.trim()} className="btn-3d h-11 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40">
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button type="button" onClick={download} disabled={!text.trim()} className={ghost}>
              Download .txt
            </button>
            <a href="https://www.cardmarket.com/en/Riftbound/Wants" target="_blank" rel="noreferrer" className={ghost}>
              Open Cardmarket wants ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-t3">
            On Cardmarket: Wants → create or open a list → “Add Deck List” → paste. Regular versions only (no foil, alt art or overnumbered).
          </p>
        </footer>
      </div>
    </div>
  );
}
