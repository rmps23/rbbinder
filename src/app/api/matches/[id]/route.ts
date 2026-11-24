import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { deleteMatch, getDeck, updateMatch } from "@/lib/repo";
import type { MatchResult } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const fail = (err: unknown, fallback: string) =>
  NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: { deckId?: string | null; notes?: string; result?: MatchResult } = {};
  try {
    if (body?.deckId === null) patch.deckId = null;
    else if (typeof body?.deckId === "string") {
      if (!(await getDeck(user.id, body.deckId))) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
      patch.deckId = body.deckId;
    }
    if (body?.result === "win" || body?.result === "loss" || body?.result === "draw") patch.result = body.result;
    if (typeof body?.notes === "string") patch.notes = body.notes.slice(0, 2000);
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    await updateMatch(user.id, id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to update the match");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  try {
    await deleteMatch(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to delete the match");
  }
}
