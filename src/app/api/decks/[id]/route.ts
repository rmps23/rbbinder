import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { deleteDeck, getDeck, listDecks, updateDeck } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown, fallback: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  try {
    const deck = await getDeck(user.id, id);
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    // it and its other versions, newest first
    const versions = (await listDecks(user.id))
      .filter((d) => d.familyId === deck.familyId)
      .sort((a, b) => b.version - a.version)
      .map((d) => ({ id: d.id, version: d.version }));
    return NextResponse.json({ ...deck, versions });
  } catch (err) {
    return fail(err, "Failed to load deck");
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: { name?: string; entries?: unknown } = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (Array.isArray(body?.entries)) patch.entries = body.entries;
  try {
    await updateDeck(user.id, id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to save deck");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  try {
    await deleteDeck(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to delete deck");
  }
}
