"use client";

import { useEffect, useState } from "react";

// Returns 0 on the first paint and `value` right after, so a CSS transition on width / height / stroke-dashoffset
// plays when a graphic first appears (and again whenever the value changes).
export function useGrown(value: number): number {
  const [g, setG] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setG(value)));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return g;
}
