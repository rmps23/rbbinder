import { NextRequest, NextResponse } from "next/server";
import { createDeck, listDecks } from "@/lib/repo";

function fail(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  // The decks table is new: point at the fix instead of a raw database error.
  const hint = /decks/i.test(message) && /(relation|schema cache|does not exist|find the table)/i.test(message)
    ? "The decks table doesn't exist yet - run supabase/schema.sql in the Supabase SQL editor."
    : message;
  return NextResponse.json({ error: hint }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json(await listDecks());
  } catch (err) {
    return fail(err, "Failed to load decks");
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  try {
    return NextResponse.json(await createDeck(name, body?.entries ?? []), { status: 201 });
  } catch (err) {
    return fail(err, "Failed to create deck");
  }
}
