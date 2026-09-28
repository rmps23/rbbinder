import { NextRequest, NextResponse } from "next/server";
import { getBinderSlots, setBinderSlot } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await getBinderSlots(id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load binder slots" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const position = body?.position;
  const cardId = body?.cardId ?? null;
  const qty = body?.qty;

  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return NextResponse.json({ error: "position must be a non-negative integer" }, { status: 400 });
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "qty must be a non-negative number" }, { status: 400 });
  }
  if (qty > 0 && typeof cardId !== "string") {
    return NextResponse.json({ error: "cardId is required when qty > 0" }, { status: 400 });
  }

  const safeQty = Math.min(Math.floor(qty), 9999);

  try {
    await setBinderSlot(id, position, cardId, safeQty);
    return NextResponse.json({ ok: true, position, cardId: safeQty > 0 ? cardId : null, qty: safeQty });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update binder slot" },
      { status: 500 }
    );
  }
}
