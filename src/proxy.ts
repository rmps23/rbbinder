import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Protect every route except:
     * - /login and /auth/* (sign in, sign up, Google callback, password reset)
     * - /api/login (the old single-password sign in)
     * - Next.js internals and static files (logo, icons, manifest)
     */
    "/((?!login|auth/|api/login|_next/static|_next/image|favicon.ico|data/|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest)$).*)",
  ],
};

const accountsEnabled = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

function signedOut(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  // Local mode: the old single site password.
  if (!accountsEnabled()) {
    const authed = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    return authed ? NextResponse.next() : signedOut(req);
  }

  // Accounts: check the Supabase session and refresh its cookies when needed.
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  // Checks the token's signature here (the project signs with ES256) instead of asking Supabase on every request.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return signedOut(req);
  return res;
}
