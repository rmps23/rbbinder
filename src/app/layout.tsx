import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RBBinder — Riftbound Collection",
  description: "Personal Riftbound TCG binder & bulk tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
