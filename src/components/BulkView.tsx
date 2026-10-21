"use client";

import { useState } from "react";
import { BulkHero } from "@/components/BulkHero";
import { CardBrowser } from "@/components/CardBrowser";

// The set picked in the hero cards filters the card list below.
export function BulkView() {
  const [setId, setSetId] = useState("");
  return (
    <div>
      <BulkHero activeSet={setId} onPickSet={setSetId} />
      <CardBrowser
        onlyOwnedLabel="Only my bulk"
        defaultOnlyOwned
        setFilter={setId}
        onSetFilterChange={setSetId}
        emptyMessage="You haven't marked any cards as bulk yet. Turn off the filter above to search for cards and add them."
      />
    </div>
  );
}
