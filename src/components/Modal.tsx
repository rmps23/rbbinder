"use client";

import { useEffect, useRef } from "react";

// A centered dialog: title bar with a close button, a scrolling body and an optional footer for the buttons.
export function Modal({
  title,
  onClose,
  footer,
  maxWidth = "max-w-2xl",
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus the first field if there is one, else the dialog itself
    (ref.current?.querySelector<HTMLElement>("textarea, input") ?? ref.current)?.focus();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-line2 bg-panel outline-none`}
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
