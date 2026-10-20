"use client";

import { use } from "react";
import { DeckBuilder } from "@/components/DeckBuilder";

export default function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DeckBuilder id={id} />;
}
