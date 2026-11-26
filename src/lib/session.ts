// Who is making this request. Two modes:
//
//  * Accounts (Supabase Auth) - when NEXT_PUBLIC_SUPABASE_URL and
//    NEXT_PUBLIC_SUPABASE_ANON_KEY are set next to the service-role key.
//    Everyone signs in with email + password or Google and only ever sees
//    their own binders, bulk and decks.
//  * Single password (the old SITE_PASSWORD gate) - for running the app
//    locally without Supabase. There is one user, "local", and it's the admin.
//
// Admins (ADMIN_EMAILS, comma separated) can run the Data & updates jobs,
// which change the card catalog everyone shares.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import { LOCAL_USER } from "./repo";

export type SessionUser = { id: string; email: string | null; isAdmin: boolean };

export function accountsEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

// Supabase client bound to this request's cookies (route handlers and server components).
export async function createSupabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a server component: the proxy refreshes the session instead
        }
      },
    },
  });
}

// Checks the token's signature without a trip to Supabase. `verify` also asks Supabase whether the account and the
// session still exist - for the admin jobs.
export async function getSessionUser(opts: { verify?: boolean } = {}): Promise<SessionUser | null> {
  if (!accountsEnabled()) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return (await verifySessionToken(token)) ? { id: LOCAL_USER, email: null, isAdmin: true } : null;
  }
  const supabase = await createSupabaseServer();
  let id: string | undefined;
  let email: string | null = null;
  if (opts.verify) {
    const { data } = await supabase.auth.getUser();
    id = data.user?.id;
    email = data.user?.email ?? null;
  } else {
    const { data } = await supabase.auth.getClaims();
    id = data?.claims.sub;
    email = data?.claims.email ?? null;
  }
  if (!id) return null;
  const user = { id, email, isAdmin: isAdminEmail(email) };
  if (user.isAdmin) await claimOrphans(user.id);
  return user;
}

// Route handler guard: the signed-in user, or a 401/403 response to return.
export async function requireUser(opts: { admin?: boolean } = {}): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser({ verify: opts.admin });
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (opts.admin && !user.isAdmin) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  return user;
}

// Rows from before accounts existed have no owner. The first time an admin
// signs in they become theirs (once per server process is enough).
let claimed = false;
async function claimOrphans(userId: string) {
  if (claimed) return;
  claimed = true;
  const { getSupabaseAdmin } = await import("./supabaseAdmin");
  const supabase = getSupabaseAdmin();
  for (const table of ["binders", "bulk", "decks"]) {
    const { error } = await supabase.from(table).update({ user_id: userId }).is("user_id", null);
    if (error) claimed = false; // e.g. the migration hasn't run yet - try again next time
  }
}
