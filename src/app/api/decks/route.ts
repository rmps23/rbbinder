import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
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
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return NextResponse.json(await listDecks(user.id));
  } catch (err) {
    return fail(err, "Failed to load decks");
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  try {
    const versionOf = typeof body?.versionOf === "string" ? body.versionOf : undefined;
    const deck = await createDeck(user.id, name, body?.entries ?? [], versionOf);
    if (!deck) return NextResponse.json({ error: "The deck this is a version of doesn't exist" }, { status: 404 });
    return NextResponse.json(deck, { status: 201 });
  } catch (err) {
    return fail(err, "Failed to create deck");
  }
}
