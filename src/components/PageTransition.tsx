"use client";

import { usePathname } from "next/navigation";

// Each page eases in (a short fade-and-rise) when you navigate. Switched off by prefers-reduced-motion.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-up">
      {children}
    </div>
  );
}
