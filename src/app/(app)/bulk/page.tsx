import { CardBrowser } from "@/components/CardBrowser";
import { BulkExport } from "@/components/BulkExport";

export default function BulkPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Bulk</h1>
      <p className="mb-5 text-sm text-white/50">
        Cartas repetidas ou disponíveis para trocas — separado do teu binder principal.
      </p>
      <BulkExport />
      <CardBrowser
        qtyField="bulk"
        accent="sky"
        onlyOwnedLabel="Mostrar só cartas com bulk"
        defaultOnlyOwned
        emptyMessage="Ainda não marcaste nenhuma carta como bulk. Desliga o filtro acima para procurar cartas e adicionar."
      />
    </div>
  );
}
