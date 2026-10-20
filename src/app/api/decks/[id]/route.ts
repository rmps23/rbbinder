import { NextRequest, NextResponse } from "next/server";
import { deleteDeck, getDeck, updateDeck } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown, fallback: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const deck = await getDeck(id);
    return deck ? NextResponse.json(deck) : NextResponse.json({ error: "Deck not found" }, { status: 404 });
  } catch (err) {
    return fail(err, "Failed to load deck");
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: { name?: string; entries?: unknown } = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (Array.isArray(body?.entries)) patch.entries = body.entries;
  try {
    await updateDeck(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to save deck");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    await deleteDeck(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Failed to delete deck");
  }
}
