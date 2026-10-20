import { BulkScanner } from "@/components/BulkScanner";
import { BulkValue } from "@/components/BulkValue";
import { CardBrowser } from "@/components/CardBrowser";

export default function BulkPage() {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-white">Bulk</h1>
        <BulkScanner />
      </div>
      <p className="mb-3 text-sm text-white/50">Duplicate or tradeable cards — kept separate from your main binder.</p>
      <BulkValue />
      <CardBrowser
        onlyOwnedLabel="Show only available"
        defaultOnlyOwned
        emptyMessage="You haven't marked any cards as bulk yet. Turn off the filter above to search for cards and add them."
      />
    </div>
  );
}
