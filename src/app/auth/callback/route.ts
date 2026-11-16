import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/session";

// Where Google sign-in, email confirmation and password-reset links land:
// trade the one-time code for a session cookie, then go on.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, req.url));
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "That link has expired or was already used. Try again.");
  return NextResponse.redirect(url);
}
