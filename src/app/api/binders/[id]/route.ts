import { NextRequest, NextResponse } from "next/server";
import { deleteBinder, getBinder, updateBinder } from "@/lib/repo";
import type { BinderLayout } from "@/lib/types";

const VALID_LAYOUTS: BinderLayout[] = ["2x2", "3x3", "3x4", "4x4"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const binder = await getBinder(id);
    if (!binder) return NextResponse.json({ error: "Binder not found" }, { status: 404 });
    return NextResponse.json(binder);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load binder" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: { name?: string; layout?: BinderLayout; pageCount?: number; sortOrder?: number } = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    patch.name = name;
  }
  if (body?.layout !== undefined) {
    if (!VALID_LAYOUTS.includes(body.layout)) {
      return NextResponse.json({ error: `layout must be one of ${VALID_LAYOUTS.join(", ")}` }, { status: 400 });
    }
    patch.layout = body.layout;
  }
  if (body?.pageCount !== undefined) {
    if (typeof body.pageCount !== "number" || !Number.isInteger(body.pageCount) || body.pageCount < 1) {
      return NextResponse.json({ error: "pageCount must be a positive integer" }, { status: 400 });
    }
    patch.pageCount = body.pageCount;
  }
  if (body?.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number") {
      return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
    }
    patch.sortOrder = body.sortOrder;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const binder = await updateBinder(id, patch);
    if (!binder) return NextResponse.json({ error: "Binder not found" }, { status: 404 });
    return NextResponse.json(binder);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update binder" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteBinder(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete binder" },
      { status: 500 }
    );
  }
}
