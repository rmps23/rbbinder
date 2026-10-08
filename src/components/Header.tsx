"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderToolbar } from "@/components/HeaderToolbarContext";

const LINKS = [
  { href: "/", label: "Binders" },
  { href: "/bulk", label: "Bulk" },
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
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" aria-label="RBBinder home" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-brand-gold bg-panel font-display text-sm font-bold text-brand-gold">
              RB
            </span>
            <span className="hidden font-display text-lg font-semibold uppercase tracking-wide text-white sm:inline">
              RBBinder
            </span>
          </Link>
          <nav className="flex gap-5 sm:gap-7">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`border-b-2 py-2 font-display text-[13px] sm:py-1 font-semibold uppercase tracking-wide transition ${
                    active
                      ? "border-brand-gold text-white"
                      : "border-transparent text-white/45 hover:text-white/80"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
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
        <button
          onClick={logout}
          aria-label="Sign out"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 sm:hidden">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12H3m0 0 3-3m-3 3 3 3M9 5V4a1 1 0 0 1 1-1h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a1 1 0 0 1-1-1v-1"
            />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
