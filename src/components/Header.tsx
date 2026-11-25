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

  // Top bar links: the icon always carries the section's colour; the active one is lit in it.
  const barLink = "flex h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-4 text-[15px] font-semibold transition-colors";

  return (
    <>
      {/* Desktop: a slim top bar */}
      <header className="sticky top-0 z-40 hidden h-[4.5rem] border-b border-line bg-ink/75 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-full max-w-[1680px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="RBBinder home" className="flex shrink-0 items-center gap-2.5">
          <span className="font-logo text-base font-medium uppercase tracking-[0.3em] text-t1">
            <b className="font-bold text-brand-gold">RB</b>Binder
          </span>
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1">
          <SlideGroup className="inline-flex gap-1 rounded-xl p-1" indicatorClassName="bg-t1/10">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className={`${barLink} ${active ? "" : "hover:text-t1"}`}
                  style={{ color: active ? "rgb(var(--t1))" : "rgb(var(--t2))" }}
                >
                  <span className="shrink-0" style={{ color: active ? "rgb(var(--accent))" : undefined }}>{l.icon}</span>
                  <span className="hidden xl:inline">{l.label}</span>
                  <span className="xl:hidden">{l.short}</span>
                </Link>
              );
            })}
          </SlideGroup>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {me?.isAdmin && (
            <Link
              href="/maintenance"
              aria-label="Data and updates"
              title="Data & updates"
              aria-current={pathname.startsWith("/maintenance") ? "page" : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                pathname.startsWith("/maintenance") ? "border-brand-gold text-brand-gold" : "border-line text-t2 hover:border-line2 hover:text-t1"
              }`}
            >
              <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
                <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
                <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" />
              </svg>
            </Link>
          )}
          <NotificationsBell className="!h-11 !w-11" />
          <button
            onClick={logout}
            aria-label="Sign out"
            title={me?.email ? `Sign out (${me.email})` : "Sign out"}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-t2 transition hover:border-bad/60 hover:bg-bad/10 hover:text-bad"
          >
            <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
              <path d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1" />
            </svg>
          </button>
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
