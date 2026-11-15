import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Protect every route except:
     * - /login (the password page itself)
     * - /api/login (the endpoint that sets the session cookie)
     * - Next.js internals and static files
     */
    // Static files (logo, icons, manifest) must load on the login page too.
    "/((?!login|api/login|_next/static|_next/image|favicon.ico|data/|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest)$).*)",
  ],
};

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await verifySessionToken(token);

  if (!authed) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
