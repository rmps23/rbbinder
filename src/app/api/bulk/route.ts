import { NextRequest, NextResponse } from "next/server";
import { getBulk, setBulkQty } from "@/lib/repo";

export async function GET() {
  try {
    return NextResponse.json(await getBulk());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load bulk" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  const variant = body?.variant;
  const qty = body?.qty;

  if (typeof cardId !== "string" || !cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (variant !== "normal" && variant !== "foil") {
    return NextResponse.json({ error: "variant must be 'normal' or 'foil'" }, { status: 400 });
  }
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "qty must be a non-negative number" }, { status: 400 });
  }

  const safeQty = Math.min(Math.floor(qty), 9999);

  try {
    await setBulkQty(cardId, variant, safeQty);
    return NextResponse.json({ ok: true, cardId, variant, qty: safeQty });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update bulk" }, { status: 500 });
  }
}
