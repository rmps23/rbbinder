import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { accountsEnabled, createSupabaseServer } from "@/lib/session";

export async function POST() {
  if (accountsEnabled()) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
