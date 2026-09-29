import { CardBrowser } from "@/components/CardBrowser";

export default function BulkPage() {
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold uppercase tracking-wide text-white">Bulk</h1>
      <p className="mb-5 text-sm text-white/50">
        Duplicate or tradeable cards — kept separate from your main binder.
      </p>
      <CardBrowser
        onlyOwnedLabel="Show only available"
        defaultOnlyOwned
        emptyMessage="You haven't marked any cards as bulk yet. Turn off the filter above to search for cards and add them."
      />
    </div>
  );
}
