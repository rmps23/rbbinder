import { CardBrowser } from "@/components/CardBrowser";

export default function BinderPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Binder</h1>
      <p className="mb-5 text-sm text-white/50">
        A tua coleção organizada. Define quantas cópias de cada carta tens guardadas no binder.
      </p>
      <CardBrowser
        qtyField="binder"
        accent="amber"
        onlyOwnedLabel="Mostrar só cartas que já tenho"
        emptyMessage="Nenhuma carta encontrada com estes filtros."
      />
    </div>
  );
}
