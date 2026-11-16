import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getUpdatedAt } from "@/lib/overrides";
import { refreshPrices, updateCardmarketLinks, updateDomainFixes, updateFinishes } from "@/lib/maintenance";

// Linking cards to Cardmarket fetches several large files.
export const maxDuration = 60;

const TASKS: Record<string, () => Promise<string>> = {
  prices: refreshPrices,
  "cardmarket-links": updateCardmarketLinks,
  finishes: updateFinishes,
  domains: updateDomainFixes,
};

// When each piece of generated data was last refreshed.
export async function GET() {
  const user = await requireUser({ admin: true });
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await getUpdatedAt());
}

export async function POST(req: NextRequest) {
  const user = await requireUser({ admin: true });
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const task = TASKS[body?.task];
  if (!task) return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, message: await task(), updatedAt: await getUpdatedAt() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}
