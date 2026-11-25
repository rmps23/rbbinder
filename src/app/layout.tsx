import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono, Oswald, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-chakra-petch",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "RBBinder — Riftbound Collection",
  description: "Personal Riftbound TCG binder & bulk tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${oswald.variable} ${chakraPetch.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) inject attributes into <body> before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
