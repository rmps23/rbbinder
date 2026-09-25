import { AppDataProvider } from "@/components/AppDataProvider";
import { Header } from "@/components/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </AppDataProvider>
  );
}
