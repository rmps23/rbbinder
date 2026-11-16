import { NextResponse } from "next/server";
import { accountsEnabled, getSessionUser } from "@/lib/session";

// Who is signed in, for the header (email, admin menu).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ email: user.email, isAdmin: user.isAdmin, accounts: accountsEnabled() });
}
