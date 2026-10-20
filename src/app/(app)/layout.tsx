import { AppDataProvider } from "@/components/AppDataProvider";
import { Header } from "@/components/Header";
import { HeaderToolbarProvider } from "@/components/HeaderToolbarContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <HeaderToolbarProvider>
        <Header />
        <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </HeaderToolbarProvider>
    </AppDataProvider>
  );
}
