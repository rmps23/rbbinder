import { NextRequest, NextResponse } from "next/server";
import { getBinderCards, setBinderCardQty } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await getBinderCards(id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load binder cards" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  const qty = body?.qty;

  if (typeof cardId !== "string" || !cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "qty must be a non-negative number" }, { status: 400 });
  }

  const safeQty = Math.min(Math.floor(qty), 9999);

  try {
    await setBinderCardQty(id, cardId, safeQty);
    return NextResponse.json({ ok: true, cardId, qty: safeQty });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update binder card" },
      { status: 500 }
    );
  }
}
