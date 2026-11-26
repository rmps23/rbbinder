import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getFinishData } from "@/lib/overrides";
import { getCardsAndSets } from "@/lib/repo";

// The whole catalog (1.5 MB of JSON) rarely changes: it's kept ready here for a minute, and a browser that already
// has it gets a 304. After a sync the app asks with ?fresh=1.
const TTL_MS = 60_000;
type Ready = { at: number; body: string; etag: string };
let ready: Ready | null = null;
let building: Promise<Ready> | null = null;

async function build(): Promise<Ready> {
  const at = Date.now();
  const [{ cards, sets }, finishes] = await Promise.all([getCardsAndSets(), getFinishData()]);
  const body = JSON.stringify({ cards, sets, finishes });
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  ready = { at, body, etag };
  return ready;
}

export async function GET(req: NextRequest) {
  try {
    const fresh = req.nextUrl.searchParams.has("fresh");
    let data = !fresh && ready && Date.now() - ready.at < TTL_MS ? ready : null;
    if (!data) {
      if (fresh || !building) building = build().finally(() => (building = null));
      data = await building;
    }
    const headers = { etag: data.etag, "cache-control": "private, no-cache" };
    // a proxy that compresses the answer may mark the tag as weak
    const known = req.headers.get("if-none-match")?.replace(/^W\//, "");
    if (known === data.etag) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(data.body, { headers: { ...headers, "content-type": "application/json" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load cards" }, { status: 500 });
  }
}
