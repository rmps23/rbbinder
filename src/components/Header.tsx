"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderToolbar } from "@/components/HeaderToolbarContext";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const LINKS = [
  {
    href: "/",
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
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toolbar } = useHeaderToolbar();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const linkCls = (active: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
      active ? "bg-accentbg text-brand-gold" : "text-t2 hover:bg-panel2 hover:text-t1"
    }`;

  return (
    <>
      {/* Desktop: fixed 240px sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-panel md:flex">
        <Link href="/" aria-label="RBBinder home" className="flex items-center gap-2.5 px-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className="font-logo text-[15px] font-medium uppercase tracking-[0.28em] text-t1">
            <b className="font-bold text-brand-gold">RB</b>Binder
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
          <p className="label px-3 pb-1 pt-2">Collection</p>
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={linkCls(active)}>
                {l.icon}
                {l.label}
              </Link>
            );
          })}
          <p className="label px-3 pb-1 pt-5">System</p>
          <Link href="/maintenance" aria-current={pathname.startsWith("/maintenance") ? "page" : undefined} className={linkCls(pathname.startsWith("/maintenance"))}>
            <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0">
              <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
              <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" />
            </svg>
            Data &amp; updates
          </Link>
        </nav>
        <div className="border-t border-line p-3">
          <button onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-t2 transition hover:bg-bad/10 hover:text-bad">
            <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5 shrink-0" aria-hidden="true">
              <path d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Page-provided toolbar slot (see HeaderToolbarContext) */}
      {toolbar && (
        <div
          className={`sticky top-0 z-20 border-b border-line bg-ink px-4 py-2 transition-opacity duration-300 md:ml-60 ${
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
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-brand-gold" : "text-t2"}`}
            >
              {l.icon}
              {l.short}
            </Link>
          );
        })}
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
