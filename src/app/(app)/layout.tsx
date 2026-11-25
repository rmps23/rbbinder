import { AppDataProvider } from "@/components/AppDataProvider";
import { CardInspectProvider } from "@/components/CardInspect";
import { TooltipLayer } from "@/components/TooltipLayer";
import { PageTransition } from "@/components/PageTransition";
import { SiteBackdrop } from "@/components/SiteBackdrop";
import { Header } from "@/components/Header";
import { HeaderToolbarProvider } from "@/components/HeaderToolbarContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <CardInspectProvider>
      <HeaderToolbarProvider>
        <SiteBackdrop />
        <Header />
        <TooltipLayer />
        <main className="mx-auto max-w-[1680px] px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8"><PageTransition>{children}</PageTransition></main>
      </HeaderToolbarProvider>
      </CardInspectProvider>
    </AppDataProvider>
  );
}
