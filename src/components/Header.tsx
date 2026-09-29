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
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-brand-gold bg-panel font-display text-sm font-bold text-brand-gold">
              RB
            </span>
            <span className="font-display text-lg font-semibold uppercase tracking-wide text-white">RBBinder</span>
          </Link>
          <nav className="flex gap-7">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`border-b-2 py-1 font-display text-[13px] font-semibold uppercase tracking-wide transition ${
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
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
