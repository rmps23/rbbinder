"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { CardText, SlantTag } from "@/components/CardText";
import { useAppData } from "@/components/AppDataProvider";
import { availableFinishes } from "@/lib/cardFinish";
import { formatEur } from "@/lib/format";
import { domainColor, rarityColor, titleCase } from "@/lib/style";
import type { RiftCard } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3.5 py-2.5">
      <p className="label">{label}</p>
      <p className="num mt-1 font-display text-xl font-bold leading-none text-t1">{value}</p>
    </div>
  );
}

// Large, readable card view with every field we have about the card.
export function CardDetailModal({
  card,
  qty,
  onQty,
  onRemove,
  onClose,
}: {
  card: RiftCard;
  qty?: number;
  onQty?: (qty: number) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const { priceOf } = useAppData();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const finishes = availableFinishes(card);
  const priced = (["normal", "foil"] as const)
    .filter((f) => finishes[f])
    .map((f) => ({ finish: f, price: priceOf(card, f) }))
    .filter((p): p is { finish: "normal" | "foil"; price: number } => p.price !== null);

  const stats: { label: string; value: string }[] = [];
  if (card.energy !== null) stats.push({ label: "Energy", value: String(card.energy) });
  if (card.might !== null) stats.push({ label: "Might", value: `${card.might}${card.mightBonus ? ` (+${card.mightBonus})` : ""}` });
  if (card.power !== null) stats.push({ label: "Power", value: String(card.power) });

  const kinds = [...(card.superTypes ?? []), ...card.types];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-line2 bg-panel outline-none md:h-[min(84vh,700px)] md:flex-row"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-t2 transition hover:border-line2 hover:text-t1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        {/* card art */}
        <div className="shrink-0 bg-panel2 p-4 md:h-full md:bg-ink md:p-5">
          <div className="relative mx-auto aspect-[744/1039] w-[min(60vw,300px)] overflow-hidden rounded-[14px] md:h-full md:w-auto">
            {card.image.url ? (
              <Image src={card.image.url} alt={card.image.alt} fill sizes="(min-width: 768px) 480px, 60vw" quality={95} priority className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center bg-ink p-4 text-center text-t3">{card.name}</span>
            )}
          </div>
        </div>

        {/* details */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6 pr-16 md:py-6 md:pl-7 md:pr-16">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <SlantTag className="bg-cavity text-brand-gold">{card.set.id}</SlantTag>
            <span className="text-t2">{card.set.name}</span>
            <span className="num text-t3">· {card.publicCode}</span>
          </p>

          <h2 className="mt-2.5 font-display text-3xl font-semibold leading-tight text-t1">{card.name}</h2>
          {card.subtitle && <p className="mt-1 text-base text-t2">{card.subtitle}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {card.rarity && (
              <SlantTag>
                <span className="h-2 w-2 rounded-full" style={{ background: rarityColor(card.rarity.id) }} aria-hidden="true" />
                {card.rarity.label}
              </SlantTag>
            )}
            {kinds.map((k) => (
              <SlantTag key={k} className="bg-cavity text-t2">
                {titleCase(k)}
              </SlantTag>
            ))}
            {card.domains.map((d) => (
              <SlantTag key={d.id}>
                <span className="h-2 w-2 rounded-full" style={{ background: domainColor(d.id) }} aria-hidden="true" />
                {d.label}
              </SlantTag>
            ))}
            {card.tags.map((t) => (
              <SlantTag key={t} className="bg-transparent text-t3 ring-1 ring-inset ring-line2">{t}</SlantTag>
            ))}
          </div>

          {stats.length > 0 && (
            <div className={`mt-4 grid gap-3 ${stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
            </div>
          )}

          {card.abilityText.trim() && (
            <section className="mt-4">
              <p className="label mb-2">Card text</p>
              <div className="rounded-lg border border-line bg-ink p-4"><CardText text={card.abilityText} /></div>
            </section>
          )}

          <dl className="mb-4 mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4 text-sm lg:grid-cols-4" title="Prices from Cardmarket (TCGplayer where unavailable), in euros">
            {priced.map((p) => (
              <div key={p.finish}>
                <dt className="label">{p.finish === "foil" ? "Foil price" : "Price"}</dt>
                <dd className="num mt-1 text-lg font-bold leading-none text-brand-gold">{formatEur(p.price)}</dd>
              </div>
            ))}
            <div>
              <dt className="label">No.</dt>
              <dd className="num mt-1 leading-none text-t1">#{card.collectorNumber}</dd>
            </div>
            {card.illustrator && (
              <div className="min-w-0">
                <dt className="label">Illustrator</dt>
                <dd className="mt-1 truncate leading-none text-t1">{card.illustrator}</dd>
              </div>
            )}
          </dl>

          {qty !== undefined && onQty && (
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
              <div className="flex items-center gap-3">
                <span className="label">Copies</span>
                <div className="flex items-center rounded-lg border border-line bg-ink p-0.5">
                  <button
                    type="button"
                    onClick={() => onQty(qty - 1)}
                    disabled={qty <= 1}
                    aria-label="One less copy"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-t2 transition hover:bg-cavity hover:text-t1 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M5 12h14" /></svg>
                  </button>
                  <span className="num w-9 text-center font-display text-xl font-bold text-t1" aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onQty(qty + 1)}
                    aria-label="One more copy"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-t2 transition hover:bg-cavity hover:text-t1"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  title="Remove this card from the slot"
                  className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-4 text-sm font-semibold text-t2 transition hover:border-bad/50 hover:bg-bad/10 hover:text-bad"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7" />
                  </svg>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
