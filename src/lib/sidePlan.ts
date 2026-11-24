// Sideboard plans sent by the browser: right shape, bounded sizes.

import type { SideCard, SidePlan } from "./types";

function cards(v: unknown): SideCard[] {
  const out = new Map<string, SideCard>();
  for (const c of (Array.isArray(v) ? v : []).slice(0, 30)) {
    const name = typeof c?.name === "string" ? c.name.trim().slice(0, 120) : "";
    const qty = typeof c?.qty === "number" && Number.isFinite(c.qty) ? Math.min(3, Math.round(c.qty)) : 0;
    if (name && qty > 0) out.set(name, { name, qty });
  }
  return [...out.values()];
}

export function cleanSidePlan(v: unknown): SidePlan | null {
  if (!v || typeof v !== "object") return null;
  const p = v as { in?: unknown; out?: unknown; note?: unknown };
  return { in: cards(p.in), out: cards(p.out), note: typeof p.note === "string" ? p.note.trim().slice(0, 300) : "" };
}
