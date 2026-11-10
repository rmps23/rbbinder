"use client";

import { useEffect, useRef, useState } from "react";

// One tooltip for the whole app. It shows on hover (mouse) or keyboard focus for:
//  - anything with a data-tip attribute, and
//  - icon-only buttons/links (no visible text), using their title or aria-label.
// The native title tooltip is suppressed while ours is showing, and restored afterwards.

const DELAY = 250;

function tipFor(el: Element): string | null {
  const tip = el.getAttribute("data-tip");
  if (tip) return tip;
  if (!(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el.getAttribute("role") === "radio")) return null;
  if ((el.textContent ?? "").trim() !== "") return null;
  return el.getAttribute("title") || el.getAttribute("aria-label");
}

function findTarget(node: EventTarget | null): { el: HTMLElement; text: string } | null {
  let el = node instanceof Element ? node : null;
  while (el) {
    if (el instanceof HTMLElement) {
      const text = tipFor(el);
      if (text) return { el, text };
    }
    el = el.parentElement;
  }
  return null;
}

export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    function hide() {
      window.clearTimeout(timer.current);
      const el = current.current;
      if (el) {
        const bak = el.getAttribute("data-title-bak");
        if (bak !== null) {
          el.setAttribute("title", bak);
          el.removeAttribute("data-title-bak");
        }
      }
      current.current = null;
      setTip(null);
    }

    function show(el: HTMLElement, text: string, immediate: boolean) {
      if (current.current === el) return;
      hide();
      current.current = el;
      // silence the browser's own tooltip
      const title = el.getAttribute("title");
      if (title !== null) {
        el.setAttribute("data-title-bak", title);
        el.removeAttribute("title");
      }
      const run = () => {
        if (current.current !== el) return;
        const r = el.getBoundingClientRect();
        const below = r.top < 56;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
      };
      if (immediate) run();
      else timer.current = window.setTimeout(run, DELAY);
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const t = findTarget(e.target);
      if (!t) return hide();
      show(t.el, t.text, false);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const to = e.relatedTarget as Node | null;
      if (current.current && to && current.current.contains(to)) return;
      hide();
    };
    const onFocus = (e: FocusEvent) => {
      const t = findTarget(e.target);
      if (!t || !(t.el as HTMLElement).matches(":focus-visible")) return;
      show(t.el, t.text, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: Math.min(Math.max(tip.x, 12), (typeof window !== "undefined" ? window.innerWidth : 1200) - 12),
        top: tip.y,
        transform: `translate(-50%, ${tip.below ? "0" : "-100%"})`,
        zIndex: 90,
      }}
      className="pointer-events-none max-w-[260px] animate-fade-in rounded-md border border-line2 bg-panel2 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-t1"
    >
      {tip.text}
    </div>
  );
}
