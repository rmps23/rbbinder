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
      <svg viewBox="0 0 24 24" {...ICON} className="h-4 w-4">
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
      <svg viewBox="0 0 24 24" {...ICON} className="h-4 w-4">
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
      <svg viewBox="0 0 24 24" {...ICON} className="h-4 w-4">
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
      <svg viewBox="0 0 24 24" {...ICON} className="h-4 w-4">
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

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-ink/75 backdrop-blur-xl">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />
      <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:px-8">
        <Link href="/" aria-label="RBBinder home" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-[#a9792a] font-display text-sm font-bold text-ink shadow-[0_0_18px_-2px_rgb(var(--accent)/0.6)] transition group-hover:rotate-6 group-hover:scale-110">
            RB
          </span>
          <span className="hidden font-display text-lg font-semibold uppercase tracking-[0.14em] text-white sm:inline">
            RB<span className="text-brand-gold">Binder</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.04] p-1">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[12px] font-semibold uppercase tracking-wide transition active:scale-95 sm:px-4 sm:text-[13px] ${
                  active
                    ? "bg-brand-gold text-ink shadow-[0_0_16px_-4px_rgb(var(--accent)/0.9)]"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="hidden sm:inline">{l.icon}</span>
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
        {/* Slot a page can fill (see HeaderToolbarContext) to fade in a
            compact control here once its own toolbar scrolls out of view. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          {toolbar && (
            <div
              className={`transition-opacity duration-300 ${
                toolbar.visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {toolbar.node}
            </div>
          )}
        </div>
        <Link
          href="/maintenance"
          aria-label="Data and updates"
          title="Data & updates"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
            pathname.startsWith("/maintenance")
              ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
              : "border-white/[0.07] bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" {...ICON} className="h-[18px] w-[18px]">
            <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
            <path d="M18.5 3v4.5H14M5.5 21v-4.5H10" />
          </svg>
        </Link>
        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] text-white/55 transition hover:border-brand-red/50 hover:bg-brand-red/10 hover:text-brand-red active:scale-95"
        >
          <svg viewBox="0 0 24 24" {...ICON} className="h-[18px] w-[18px]">
            <path d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
