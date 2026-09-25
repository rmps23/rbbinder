import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { CollectionMap } from "@/lib/types";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("collection").select("card_id, binder_qty, bulk_qty");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const map: CollectionMap = {};
    for (const row of data ?? []) {
      map[row.card_id] = { binder: row.binder_qty ?? 0, bulk: row.bulk_qty ?? 0 };
    }
    return NextResponse.json(map);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  const field = body?.field;
  const qty = body?.qty;

  if (typeof cardId !== "string" || !cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (field !== "binder" && field !== "bulk") {
    return NextResponse.json({ error: "field must be 'binder' or 'bulk'" }, { status: 400 });
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "qty must be a non-negative number" }, { status: 400 });
  }

  const safeQty = Math.min(Math.floor(qty), 9999);
  const column = field === "binder" ? "binder_qty" : "bulk_qty";

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("collection")
      .upsert({ card_id: cardId, [column]: safeQty, updated_at: new Date().toISOString() }, { onConflict: "card_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cardId, field, qty: safeQty });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}
