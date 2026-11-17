"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import type { RiftCard } from "@/lib/types";

// TCGplayer has no picture for some promo/alternate printings (the CDN answers 403). When a card's own
// picture fails to load we show the same card's regular printing instead, and remember which cards failed
// so the next visit goes straight to the fallback.

const KEY = "rbbinder:brokenImages";
let broken: Set<string> | null = null;

function brokenSet(): Set<string> {
  if (!broken) {
    broken = new Set();
    try {
      for (const id of JSON.parse(localStorage.getItem(KEY) ?? "[]")) broken.add(id);
    } catch {
      // no storage
    }
  }
  return broken;
}

function markBroken(id: string) {
  const set = brokenSet();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    // not remembered
  }
}

export function CardImage({
  card,
  alt,
  onError,
  ...rest
}: Omit<ImageProps, "src" | "alt"> & { card: RiftCard; alt?: string }) {
  const { imageFallbackOf } = useAppData();
  const fallback = imageFallbackOf(card);
  const [failed, setFailed] = useState(() => brokenSet().has(card.id));

  useEffect(() => {
    setFailed(brokenSet().has(card.id));
  }, [card.id]);

  const url = failed && fallback ? fallback : card.image.url;
  if (!url) return null;

  return (
    <Image
      {...rest}
      src={url}
      alt={alt ?? card.image.alt}
      onError={(e) => {
        if (!failed && fallback) {
          markBroken(card.id);
          setFailed(true);
          return;
        }
        onError?.(e);
      }}
    />
  );
}
