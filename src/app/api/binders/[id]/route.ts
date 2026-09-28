import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Binder, BinderLayout } from "@/lib/types";

const VALID_LAYOUTS: BinderLayout[] = ["2x2", "3x3", "3x4", "4x4"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: binder, error: binderError }, { data: qtyRows, error: qtyError }] = await Promise.all([
      supabase.from("binders").select("*").eq("id", id).maybeSingle(),
      supabase.from("binder_cards").select("qty").eq("binder_id", id).gt("qty", 0),
    ]);

    if (binderError) return NextResponse.json({ error: binderError.message }, { status: 500 });
    if (!binder) return NextResponse.json({ error: "Binder not found" }, { status: 404 });
    if (qtyError) return NextResponse.json({ error: qtyError.message }, { status: 500 });

    const result: Binder = {
      id: binder.id,
      name: binder.name,
      layout: binder.layout,
      sortOrder: binder.sort_order,
      createdAt: binder.created_at,
      uniqueCount: qtyRows?.length ?? 0,
      totalQty: (qtyRows ?? []).reduce((sum, r) => sum + r.qty, 0),
    };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    update.name = name;
  }
  if (body?.layout !== undefined) {
    if (!VALID_LAYOUTS.includes(body.layout)) {
      return NextResponse.json({ error: `layout must be one of ${VALID_LAYOUTS.join(", ")}` }, { status: 400 });
    }
    update.layout = body.layout;
  }
  if (body?.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number") {
      return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
    }
    update.sort_order = body.sortOrder;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("binders").update(update).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: data.id,
      name: data.name,
      layout: data.layout,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("binders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured" },
      { status: 500 }
    );
  }
}
