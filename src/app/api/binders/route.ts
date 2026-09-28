import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Binder, BinderLayout } from "@/lib/types";

const VALID_LAYOUTS: BinderLayout[] = ["2x2", "3x3", "3x4", "4x4"];

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: binders, error: bindersError }, { data: qtyRows, error: qtyError }] = await Promise.all([
      supabase.from("binders").select("*").order("sort_order").order("created_at"),
      supabase.from("binder_cards").select("binder_id, qty").gt("qty", 0),
    ]);

    if (bindersError) return NextResponse.json({ error: bindersError.message }, { status: 500 });
    if (qtyError) return NextResponse.json({ error: qtyError.message }, { status: 500 });

    const stats = new Map<string, { uniqueCount: number; totalQty: number }>();
    for (const row of qtyRows ?? []) {
      const s = stats.get(row.binder_id) ?? { uniqueCount: 0, totalQty: 0 };
      s.uniqueCount += 1;
      s.totalQty += row.qty;
      stats.set(row.binder_id, s);
    }

    const result: Binder[] = (binders ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      layout: b.layout,
      sortOrder: b.sort_order,
      createdAt: b.created_at,
      uniqueCount: stats.get(b.id)?.uniqueCount ?? 0,
      totalQty: stats.get(b.id)?.totalQty ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const layout = body?.layout;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!VALID_LAYOUTS.includes(layout)) {
    return NextResponse.json({ error: `layout must be one of ${VALID_LAYOUTS.join(", ")}` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("binders").insert({ name, layout }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const binder: Binder = {
      id: data.id,
      name: data.name,
      layout: data.layout,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      uniqueCount: 0,
      totalQty: 0,
    };
    return NextResponse.json(binder, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}
