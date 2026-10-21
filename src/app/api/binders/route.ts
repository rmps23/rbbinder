import { NextRequest, NextResponse } from "next/server";
import { createBinder, listBinders } from "@/lib/repo";
import type { BinderLayout } from "@/lib/types";

const VALID_LAYOUTS: BinderLayout[] = ["2x2", "3x3", "3x4", "4x4"];

// The set_id column is new: point at the fix instead of a raw database error.
function friendly(message: string) {
  return /set_id/i.test(message)
    ? "The binders table needs the new set column - run supabase/schema.sql in the Supabase SQL editor."
    : message;
}


export async function GET() {
  try {
    return NextResponse.json(await listBinders());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load binders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const layout = body?.layout;
  const setId = typeof body?.setId === "string" && body.setId.trim() ? body.setId.trim().slice(0, 20) : null;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!VALID_LAYOUTS.includes(layout)) {
    return NextResponse.json({ error: `layout must be one of ${VALID_LAYOUTS.join(", ")}` }, { status: 400 });
  }

  try {
    const binder = await createBinder(name, layout, setId);
    return NextResponse.json(binder, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: friendly(err instanceof Error ? err.message : "Failed to create binder") },
      { status: 500 }
    );
  }
}
