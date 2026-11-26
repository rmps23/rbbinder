"use client";

import { SlideGroup } from "@/components/SlideGroup";
import { NotificationsBell } from "@/components/NotificationsBell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cacheClear } from "@/lib/clientCache";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderToolbar } from "@/components/HeaderToolbarContext";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const LINKS = [
  {
    href: "/",
    hue: "74 192 222",
    label: "Dashboard",
    short: "Home",
    match: (p: string) => p === "/",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/binders",
    hue: "183 148 246",
    label: "Binders",
    short: "Binders",
    match: (p: string) => p.startsWith("/binder"),
    icon: (
      <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
        <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" />
      </svg>
    ),
  },
  {
    href: "/bulk",
    hue: "245 184 75",
    label: "Bulk",
    short: "Bulk",
    match: (p: string) => p.startsWith("/bulk"),
    icon: (
      <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
      </svg>
    ),
  },
  {
    href: "/decks",
    hue: "244 114 182",
    label: "Decks",
    short: "Decks",
    match: (p: string) => p.startsWith("/decks"),
    icon: (
      <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
        <rect x="7" y="3" width="13" height="17" rx="2" />
        <path d="M4 7v12a2 2 0 0 0 2 2h9" />
      </svg>
    ),
  },
  {
    href: "/matches",
    hue: "61 214 160",
    label: "Match history",
    short: "Matches",
    match: (p: string) => p.startsWith("/matches"),
    icon: (
      <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4v3h-4z" />
      </svg>
    ),
  },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toolbar } = useHeaderToolbar();
  // Who's signed in: their email under the menu, and the admin-only Data page.
  const [me, setMe] = useState<{ email: string | null; isAdmin: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    await cacheClear(); // the next person on this browser mustn't see this collection
    router.push("/login");
    router.refresh();
  }

  const iconBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] text-[rgb(var(--t2))] transition-colors hover:bg-white/10 hover:text-white";

  return (
    <>
      {/* Desktop: a floating glass bar across the top, with cut corners */}
      <header className="sticky top-0 z-40 hidden h-[4.5rem] md:block">
        <div className="mx-auto h-full max-w-[1680px] px-4 pt-2.5 sm:px-6 lg:px-8">
          <div className="navbar-glass flex h-14 items-center gap-3 pl-5 pr-3">
            <Link href="/" aria-label="RBBinder home" className="flex shrink-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-mark.svg" alt="" className="h-11 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-wordmark.svg" alt="RBBinder" className="h-auto w-[46px]" />
            </Link>

            <i aria-hidden="true" className="mx-2 hidden h-6 w-px -skew-x-[22deg] bg-white/15 lg:block" />

            <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-1">
              {LINKS.map((l) => {
                const active = l.match(pathname);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    title={l.label}
                    aria-label={l.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold transition-colors lg:px-4 ${
                      active ? "nav-active text-white" : "text-[rgb(var(--t2))] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {l.icon}
                    <span className="hidden xl:inline">{l.label}</span>
                    <span className="hidden lg:inline xl:hidden">{l.short}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              {me?.isAdmin && (
                <Link href="/maintenance" title="Data & updates" aria-label="Data and updates" aria-current={pathname.startsWith("/maintenance") ? "page" : undefined} className={`${iconBtn} ${pathname.startsWith("/maintenance") ? "nav-active !text-white" : ""}`}>
                  <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
                    <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
                    <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" />
                  </svg>
                </Link>
              )}
              <NotificationsBell className="!h-10 !w-10 !rounded-[3px] !border-transparent" />
              <button onClick={logout} aria-label="Sign out" title={me?.email ? `Sign out (${me.email})` : "Sign out"} className={iconBtn}>
                <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
                  <path d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page-provided toolbar slot (see HeaderToolbarContext) */}
      {toolbar && (
        <div
          className={`sticky top-0 z-30 border-b border-line bg-ink px-4 py-2 transition-opacity duration-300 md:top-[4.5rem] ${
            toolbar.visible ? "opacity-100" : "pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0"
          }`}
        >
          <div className="mx-auto flex max-w-[1680px] items-center justify-center">{toolbar.node}</div>
        </div>
      )}

      {/* Mobile: bottom bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-t1" : "text-t2"}`}
              style={{ color: active ? "rgb(var(--accent))" : undefined }}
            >
              {l.icon}
              {l.short}
            </Link>
          );
        })}
        {me?.isAdmin && (
        <Link
          href="/maintenance"
          aria-label="Data and updates"
          aria-current={pathname.startsWith("/maintenance") ? "page" : undefined}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${pathname.startsWith("/maintenance") ? "text-brand-gold" : "text-t2"}`}
        >
          <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5">
            <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
            <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" />
          </svg>
          Data
        </Link>
        )}
        <div className="flex min-h-14 flex-1 items-center justify-center">
          <NotificationsBell className="border-transparent" />
        </div>
        <button onClick={logout} aria-label="Sign out" className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-t2">
          <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
            <path d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1" />
          </svg>
          Exit
        </button>
      </nav>
    </>
  );
}
