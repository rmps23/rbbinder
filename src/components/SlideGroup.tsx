"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// A segmented control / tab strip whose highlight slides to the active option.
// Mark the active child with data-active="true" (and give it a transparent background:
// the highlight is drawn behind it). Children need `relative` + a z-index above the highlight
// - SlideGroup adds that to direct children automatically via the [&>*] selector.
export function SlideGroup({
  className = "",
  indicatorClassName = "bg-brand-gold",
  children,
  ...rest
}: {
  className?: string;
  indicatorClassName?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const prev = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const measure = () => {
    const root = ref.current;
    const el = root?.querySelector<HTMLElement>('[data-active="true"]');
    if (!root || !el) return setBox(null);
    const next = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    setBox((b) => (b && b.left === next.left && b.top === next.top && b.width === next.width && b.height === next.height ? b : next));
  };

  // re-measure after every render (cheap, and bails out when nothing moved)
  useLayoutEffect(measure);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Slide the highlight from where it was to where it is now (Web Animations API, so it doesn't depend
  // on CSS transition state). The movement is short; with reduced motion it is shorter still.
  useLayoutEffect(() => {
    const el = indicator.current;
    const from = prev.current;
    prev.current = box;
    if (!el || !box || !from) return;
    if (from.left === box.left && from.top === box.top && from.width === box.width && from.height === box.height) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.animate(
      [
        { transform: `translate(${from.left}px, ${from.top}px)`, width: `${from.width}px`, height: `${from.height}px` },
        { transform: `translate(${box.left}px, ${box.top}px)`, width: `${box.width}px`, height: `${box.height}px` },
      ],
      { duration: reduce ? 160 : 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [box]);

  return (
    <div ref={ref} className={`relative [&>*:not([data-slide-indicator])]:relative [&>*:not([data-slide-indicator])]:z-10 ${className}`} {...rest}>
      {box && (
        <span
          ref={indicator}
          aria-hidden="true"
          data-slide-indicator=""
          className={`pointer-events-none absolute z-0 rounded-[inherit] ${indicatorClassName}`}
          style={{ left: 0, top: 0, width: box.width, height: box.height, transform: `translate(${box.left}px, ${box.top}px)`, borderRadius: "0.5rem" }}
        />
      )}
      {children}
    </div>
  );
}
