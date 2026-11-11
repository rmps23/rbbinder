"use client";

import Image from "next/image";
import { useCallback, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { displayName } from "@/lib/deck";
import { formatEur } from "@/lib/format";
import { domainColor } from "@/lib/style";
import { isLandscape } from "@/lib/cardUtils";
import type { DeckEntry, DeckZone, RiftCard } from "@/lib/types";

export type Row = { entry: DeckEntry; card: RiftCard };

export function CardArt({ card, sizes, className = "", quality }: { card: RiftCard; sizes: string; className?: string; quality?: number }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#0a0c10] ring-1 ring-line2 ${isLandscape(card) ? "aspect-[1039/744]" : "aspect-[744/1039]"} ${className}`}
    >
      {card.image.url ? (
        <Image src={card.image.url} alt={card.image.alt} fill sizes={sizes} quality={quality} className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-t3">{card.name}</span>
      )}
    </div>
  );
}

// ---------- hover preview ----------

// Hovering a card (mouse only) shows it big next to the pointer, so its text can
// be read. `bind(card)` gives the handlers to spread on whatever shows the card;
// `node` is the floating preview, rendered once by the owner.
const PREVIEW_LONG = 420; // the long side: tall for upright cards, wide for battlefields
const PREVIEW_SHORT = Math.round((PREVIEW_LONG * 744) / 1039);
const GAP = 22;

export type PreviewBind = (card: RiftCard) => {
  onPointerEnter: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: () => void;
};

type PreviewState = { card: RiftCard; x: number; y: number } | null;

// A tiny store so moving the mouse only re-renders the floating preview, never
// the whole deck builder.
function createPreviewStore() {
  let state: PreviewState = null;
  const listeners = new Set<() => void>();
  const set = (s: PreviewState) => {
    state = s;
    listeners.forEach((l) => l());
  };
  return {
    get: () => state,
    set,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
type PreviewStore = ReturnType<typeof createPreviewStore>;

function PreviewLayer({ store }: { store: PreviewStore }) {
  const state = useSyncExternalStore(store.subscribe, store.get, () => null);
  if (!state) return null;
  const { card, x, y } = state;
  const PREVIEW_W = isLandscape(card) ? PREVIEW_LONG : PREVIEW_SHORT;
  const PREVIEW_H = isLandscape(card) ? PREVIEW_SHORT : PREVIEW_LONG;
  // right of the pointer, or left when there's no room; kept inside the window
  const left = x + GAP + PREVIEW_W > window.innerWidth - 8 ? x - GAP - PREVIEW_W : x + GAP;
  const top = Math.max(8, Math.min(y - PREVIEW_H / 3, window.innerHeight - PREVIEW_H - 8));
  return (
    <div
      className="pointer-events-none fixed z-[60] overflow-hidden rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/20"
      style={{ left, top, width: PREVIEW_W, height: PREVIEW_H }}
      aria-hidden
    >
      {card.image.url ? (
        <Image src={card.image.url} alt="" fill sizes={`${PREVIEW_W}px`} className="bg-[#0a0c10] object-cover" priority />
      ) : (
        <span className="flex h-full items-center justify-center bg-panel p-4 text-center text-sm text-t2">{displayName(card)}</span>
      )}
    </div>
  );
}

export function useCardPreview() {
  const store = useRef<PreviewStore | null>(null);
  if (!store.current) store.current = createPreviewStore();
  const st = store.current;

  const bind = useCallback<PreviewBind>(
    (card) => ({
      onPointerEnter: (e) => {
        if (e.pointerType === "mouse") st.set({ card, x: e.clientX, y: e.clientY });
      },
      onPointerMove: (e) => {
        if (e.pointerType === "mouse") st.set({ card, x: e.clientX, y: e.clientY });
      },
      onPointerLeave: () => st.set(null),
    }),
    [st]
  );

  return { bind, node: <PreviewLayer store={st} /> };
}

export function DomainDots({ card }: { card: RiftCard }) {
  return (
    <span className="inline-flex items-center gap-1">
      {card.domains.map((d) => (
        <span
          key={d.id}
          title={d.label}
          className="inline-block h-2 w-2 rounded-full ring-1 ring-black/40"
          style={{ background: domainColor(d.id) }}
        />
      ))}
    </span>
  );
}

function Pip({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "cyan" }) {
  return (
    <span
      className={`num inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-bold ${
        tone === "gold" ? "bg-brand-gold text-on-accent" : "bg-ok text-on-accent"
      }`}
    >
      {children}
    </span>
  );
}
export { Pip };

// "How many do I own?" badge. Without `need` (the card pool) it's cyan when you
// own it and dim when you don't; with `need` (a card in the deck) it's green when
// you have enough copies, amber when you have some, red when you have none.
export function OwnedBadge({ owned, need, className = "", large = false }: { owned: number; need?: number; className?: string; large?: boolean }) {
  const tone =
    need === undefined
      ? owned > 0
        ? "text-ok"
        : "text-t3"
      : owned >= need
        ? "text-ok"
        : owned > 0
          ? "text-warn"
          : "text-bad";
  const dot =
    need === undefined
      ? owned > 0
        ? "bg-ok"
        : "bg-t3"
      : owned >= need
        ? "bg-ok"
        : owned > 0
          ? "bg-warn"
          : "bg-bad";
  const title =
    need === undefined
      ? `You own ${owned}`
      : owned >= need
        ? `You own ${owned} - enough for this deck (${need})`
        : `You own ${owned} of the ${need} this deck needs`;
  if (large) {
    // card pool: a big pill that is green when you own the card and plain when you don't
    const has = owned > 0;
    return (
      <span
        title={title}
        className={`pointer-events-none inline-flex h-8 items-center gap-2 rounded-lg px-2.5 font-bold leading-none tabular-nums ring-2 ${
          has ? "bg-ink text-ok ring-ok" : "bg-ink text-t2 ring-line2"
        } ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" role="img" aria-label="You own">
          <title>You own</title>
          <rect x="7" y="3" width="13" height="17" rx="2" />
          <path d="M4 7v12a2 2 0 0 0 2 2h9" />
          {has && <path d="m11 11.5 2 2 3.5-4" />}
        </svg>
        <span className="text-base">{owned}</span>
      </span>
    );
  }
  return (
    <span
      title={title}
      className={`pointer-events-none inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-xs font-bold leading-none tabular-nums ring-1 ring-line2 ${tone} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {need === undefined && <span className="font-semibold text-t2">Own</span>}
      <span className="text-sm">{owned}</span>
      {need !== undefined && owned < need && <span className="font-medium text-t3">/{need}</span>}
    </span>
  );
}

function RowButton({
  children,
  onClick,
  title,
  tone = "plain",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "gold" | "plain";
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
        tone === "gold"
          ? "border-brand-gold/50 text-brand-gold hover:bg-brand-gold hover:text-on-accent"
          : "border-line bg-ink text-t2 hover:border-line2 hover:text-t1"
      }`}
    >
      {children}
    </button>
  );
}

// A small square button with an eye: hovering it shows the big card preview, clicking it opens the full details.
export function EyeButton({ card, preview, onInspect, className = "", small = false }: { card: RiftCard; preview: PreviewBind; onInspect: (card: RiftCard) => void; className?: string; small?: boolean }) {
  return (
    <button
      type="button"
      {...preview(card)}
      onClick={(e) => {
        e.stopPropagation();
        onInspect(card);
      }}
      aria-label={`Preview ${displayName(card)}`}
      title="Preview card"
      className={`flex shrink-0 items-center justify-center rounded-lg border border-line bg-ink text-t2 transition hover:border-line2 hover:text-t1 ${small ? "h-7 w-7" : "h-9 w-9"} ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={small ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

// ---------- list ----------

export function ListView({
  zones,
  rowsByZone,
  countOf,
  canChampion,
  versionsOf,
  ownedOf,
  neededOf,
  preview,
  onInspect,
  onPickPrinting,
  onAdjust,
  onMove,
}: {
  zones: { id: DeckZone; label: string; target: number | null; max: number | null }[];
  rowsByZone: Map<DeckZone, Row[]>;
  countOf: (z: DeckZone) => number;
  canChampion: (card: RiftCard) => boolean;
  versionsOf: (card: RiftCard) => number;
  ownedOf: (card: RiftCard) => number;
  neededOf: (card: RiftCard) => number;
  preview: PreviewBind;
  onInspect: (card: RiftCard) => void;
  onPickPrinting: (row: Row) => void;
  onAdjust: (row: Row, delta: number) => void;
  onMove: (row: Row, to: DeckZone) => void;
}) {
  const renderRow = (row: Row, compact: boolean) => {
    const { entry, card } = row;
    const versions = versionsOf(card);
    const art = (
      <div className={`relative shrink-0 ${isLandscape(card) ? (compact ? "w-24" : "w-28") : compact ? "w-[72px]" : "w-16"}`}>
        <button type="button" onClick={() => onInspect(card)} title={`${displayName(card)} - open details`} className="block w-full">
          <CardArt card={card} sizes="160px" quality={90} className="rounded-md" />
        </button>
        {versions > 1 && (
          <button
            type="button"
            onClick={() => onPickPrinting(row)}
            title={`Choose the version (${versions} available)`}
            className="num absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-cavity px-1 text-[10px] font-bold text-t1 ring-1 ring-line2 transition hover:bg-panel2 hover:ring-brand-gold"
          >
            {versions}
          </button>
        )}
      </div>
    );
    const label = (
      <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-t1" title={displayName(card)}>{displayName(card)}</span>
                              <span className="mt-1 flex items-center gap-2">
                                <OwnedBadge owned={ownedOf(card)} need={neededOf(card)} />
                              </span>
                            </span>
    );
    const actions = (
      <span className={`flex items-center gap-1.5 ${compact ? "flex-wrap" : ""}`}>
                              <EyeButton card={card} preview={preview} onInspect={onInspect} />
                              {entry.zone === "main" && card.types.includes("unit") && canChampion(card) && (
                                <RowButton tone="gold" onClick={() => onMove(row, "champion")} title="Use as your chosen champion">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.8 3.1 1.1-6.5L2.6 9.8l6.5-.9L12 3Z" /></svg>
                                </RowButton>
                              )}
                              {entry.zone === "main" && (
                                <RowButton onClick={() => onMove(row, "sideboard")} title="Move one copy to the sideboard">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M7 7h13m-4-4 4 4-4 4M17 17H4m4-4-4 4 4 4" /></svg>
                                </RowButton>
                              )}
                              {entry.zone === "sideboard" && (
                                <RowButton onClick={() => onMove(row, "main")} title="Move one copy to the main deck">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M7 7h13m-4-4 4 4-4 4M17 17H4m4-4-4 4 4 4" /></svg>
                                </RowButton>
                              )}
                              {entry.zone === "champion" && (
                                <RowButton onClick={() => onMove(row, "main")} title="Put it back in the main deck (unset champion)">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                                </RowButton>
                              )}
                              <span className="flex items-center rounded-lg border border-line bg-ink">
                                <button
                                  type="button"
                                  aria-label={`Remove one ${displayName(card)}`}
                                  onClick={() => onAdjust(row, -1)}
                                  className="flex h-9 w-9 items-center justify-center rounded-l-lg text-t2 transition hover:bg-bad/15 hover:text-bad"
                                >
                                  −
                                </button>
                                <span key={entry.qty} className="num w-7 animate-pop text-center font-display text-lg font-bold leading-none text-brand-gold" aria-live="polite">
                                  {entry.qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Add one ${displayName(card)}`}
                                  onClick={() => onAdjust(row, 1)}
                                  className="flex h-9 w-9 items-center justify-center rounded-r-lg text-t2 transition hover:bg-cavity hover:text-t1"
                                >
                                  +
                                </button>
                              </span>
                            </span>
    );
    return (
      <li
        key={`${entry.zone}:${entry.cardId}`}
        className={`items-center gap-3 rounded-xl border border-line bg-panel2 p-2 transition hover:border-line2 ${
          compact ? "grid grid-cols-[auto_minmax(0,1fr)] items-start" : "grid grid-cols-[auto_minmax(0,1fr)_auto]"
        }`}
      >
        {art}
        {compact ? (
          <span className="flex min-w-0 flex-col gap-1.5">
            {label}
            {actions}
          </span>
        ) : (
          <>
            {label}
            {actions}
          </>
        )}
      </li>
    );
  };

  // two = rows go in two columns (main deck); the legend and the champion sit side by side.
  const renderSection = (zone: (typeof zones)[number], two: boolean) => {
    const rows = rowsByZone.get(zone.id) ?? [];
    const count = countOf(zone.id);
    const goal = zone.target ?? zone.max;
    const done = zone.target !== null && count >= zone.target;
    return (
      <section key={zone.id} className="min-w-0">
        <h3 className="mb-2 flex items-center justify-between font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1">
          {zone.label}
          <span
            className={`num rounded-md px-2 py-0.5 text-xs font-semibold tracking-normal ${
              done ? "bg-ok/15 text-ok" : "bg-cavity text-t2"
            }`}
          >
            {done ? "✓ " : ""}
            {count}
            {goal ? ` / ${goal}` : ""}
          </span>
        </h3>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line2 py-3 text-center text-xs text-t3">Nothing here yet</p>
        ) : (
          <ul className={two ? "grid grid-cols-1 gap-1.5 min-[560px]:grid-cols-2" : "flex flex-col gap-1.5"}>
            {rows.map((row) => renderRow(row, two || zone.id === "legend" || zone.id === "champion"))}
          </ul>
        )}
      </section>
    );
  };

  const legend = zones.find((z) => z.id === "legend");
  const champion = zones.find((z) => z.id === "champion");

  return (
    <div className="flex flex-col gap-5">
      {legend && champion && (
        <div className="grid grid-cols-2 items-start gap-3">
          {renderSection(legend, false)}
          {renderSection(champion, false)}
        </div>
      )}
      {zones
        .filter((z) => !(legend && champion && (z.id === "legend" || z.id === "champion")))
        .map((zone) => renderSection(zone, zone.id === "main"))}
    </div>
  );
}

// ---------- full art ----------

export function ArtView({
  zones,
  rowsByZone,
  ownedOf,
  neededOf,
  preview,
  onInspect,
  onAdjust,
}: {
  zones: { id: DeckZone; label: string }[];
  rowsByZone: Map<DeckZone, Row[]>;
  ownedOf: (card: RiftCard) => number;
  neededOf: (card: RiftCard) => number;
  preview: PreviewBind;
  onInspect: (card: RiftCard) => void;
  onAdjust: (row: Row, delta: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {zones.map((zone) => {
        const rows = rowsByZone.get(zone.id) ?? [];
        if (!rows.length) return null;
        return (
          <section key={zone.id}>
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1">{zone.label}</h3>
            <div className={rows[0] && isLandscape(rows[0].card) ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}>
              {rows.map((row) => (
                <div key={`${row.entry.zone}:${row.entry.cardId}`} className="group relative animate-card-in">
                  <button
                    type="button"
                    onClick={() => onAdjust(row, 1)}
                    className="block w-full rounded-lg ring-2 ring-transparent transition hover:ring-brand-gold/70"
                  >
                    <CardArt card={row.card} sizes="(min-width: 1024px) 240px, 30vw" quality={92} className="rounded-lg" />
                  </button>
                  <EyeButton card={row.card} preview={preview} onInspect={onInspect} className="absolute left-1 top-1 bg-ink/95 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100" />
                  <OwnedBadge owned={ownedOf(row.card)} need={neededOf(row.card)} className="absolute bottom-1 left-1" />
                  <span
                    key={row.entry.qty}
                    className="num absolute -right-1 -top-1 flex h-6 min-w-6 animate-pop items-center justify-center rounded-md bg-brand-gold px-1 text-xs font-bold text-on-accent"
                  >
                    ×{row.entry.qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove one"
                    onClick={() => onAdjust(row, -1)}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-md border border-line2 bg-ink/95 text-sm text-t1 opacity-0 transition hover:border-bad hover:text-bad focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- bulk comparison ----------

export type CompareData = {
  have: { key: string; card: RiftCard; qty: number; needed: number }[];
  missing: { key: string; card: RiftCard; qty: number; price: number | null }[];
  missingCost: number;
  missingUnpriced: number;
  totalNeeded: number;
  totalHave: number;
};

function SectionToggle({ open, onToggle, label, count, tone }: { open: boolean; onToggle: () => void; label: string; count: number; tone: "ok" | "bad" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-ink px-3.5 text-left transition hover:border-line2"
    >
      <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1">{label}</span>
      <span className="flex items-center gap-3">
        <span className={`num rounded-md px-2 py-0.5 text-xs font-semibold ${tone === "ok" ? "bg-brand-gold/15 text-brand-gold" : "bg-bad/15 text-bad"}`}>{count}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 text-t3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}

export function BulkView({
  compare,
  hasCards,
  includeRunes,
  onIncludeRunes,
  includeSideboard,
  onIncludeSideboard,
  onWants,
  preview,
  onInspect,
}: {
  compare: CompareData;
  hasCards: boolean;
  includeRunes: boolean;
  onIncludeRunes: (v: boolean) => void;
  includeSideboard: boolean;
  onIncludeSideboard: (v: boolean) => void;
  onWants: () => void;
  preview: PreviewBind;
  onInspect: (card: RiftCard) => void;
}) {
  const [haveOpen, setHaveOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const pct = compare.totalNeeded ? Math.round((compare.totalHave / compare.totalNeeded) * 100) : 0;
  const complete = pct >= 100;

  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex h-11 flex-1 items-center justify-between gap-3 rounded-lg border border-line bg-ink px-3.5 text-sm font-semibold text-t2 transition hover:border-line2"
    >
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand-gold" : "bg-cavity"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* summary */}
      <section className="rounded-xl border border-line bg-ink p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">You own</p>
            <p className="num mt-1 font-display text-3xl font-bold leading-none">
              <span className="text-ok">{compare.totalHave}</span>
              <span className="text-t3"> / {compare.totalNeeded}</span>
            </p>
          </div>
          <span className={`num rounded-md px-2.5 py-1 text-sm font-bold ${complete ? "bg-ok/15 text-ok" : "bg-cavity text-t1"}`}>
            {complete ? "✓ " : ""}
            {pct}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-sm bg-cavity">
          <div className={`h-full rounded-sm transition-all duration-700 ${complete ? "bg-ok" : "bg-brand-gold"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-t3">Cards from bulk and binders, regular versions.</p>

        {compare.missing.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 px-3.5 py-3">
            <div>
              <p className="label">To complete it</p>
              <p className="num mt-1 text-xl font-bold leading-none text-brand-gold">{formatEur(compare.missingCost)}</p>
            </div>
            <p className="max-w-[11rem] text-right text-[11px] leading-snug text-t3">
              Cheapest printing, Cardmarket trend
              {compare.missingUnpriced ? ` · ${compare.missingUnpriced} without a price` : ""}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Toggle on={includeRunes} onChange={onIncludeRunes} label="Include runes" />
          <Toggle on={includeSideboard} onChange={onIncludeSideboard} label="Include sideboard" />
        </div>

        {compare.missing.length > 0 && (
          <button
            type="button"
            onClick={onWants}
            className="btn-3d mt-4 flex h-11 w-full items-center justify-center rounded-lg font-display text-xs font-semibold uppercase tracking-wide"
          >
            Export missing cards for Cardmarket
          </button>
        )}
      </section>

      {/* have */}
      <section>
        <SectionToggle open={haveOpen} onToggle={() => setHaveOpen((o) => !o)} label="In your collection" count={compare.have.length} tone="ok" />
        {haveOpen &&
          (compare.have.length === 0 ? (
            <p className="mt-2.5 rounded-lg border border-dashed border-line2 py-4 text-center text-xs text-t3">Nothing from the deck is in your collection.</p>
          ) : (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {compare.have.map((r) => (
                <div key={r.key} className="group">
                  <div className="relative overflow-hidden rounded-lg border-2 border-brand-gold/70" title={displayName(r.card)}>
                    <button type="button" onClick={() => onInspect(r.card)} className="block w-full"><CardArt card={r.card} sizes="(min-width: 1024px) 160px, 20vw" quality={90} className="rounded-none ring-0" /></button>
                    <EyeButton small card={r.card} preview={preview} onInspect={onInspect} className="absolute left-1 top-1 bg-ink/95 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100" />
                    <span className="num absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-gold px-1 text-[11px] font-bold text-on-accent">
                      {r.qty}
                      {r.qty < r.needed ? `/${r.needed}` : ""}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] text-t2">{displayName(r.card)}</p>
                </div>
              ))}
            </div>
          ))}
      </section>

      {/* missing */}
      <section>
        <SectionToggle open={missingOpen} onToggle={() => setMissingOpen((o) => !o)} label="Missing" count={compare.missing.length} tone="bad" />
        {missingOpen &&
          (compare.missing.length === 0 ? (
            <p className="mt-2.5 rounded-lg border border-dashed border-line2 py-4 text-center text-xs text-t3">
              {hasCards ? "✓ You have everything. Time to sleeve up!" : "Add cards to the deck."}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {compare.missing.map((r) => (
                <div key={r.key} className="group">
                  <div className="relative overflow-hidden rounded-lg border-2 border-bad/60" title={displayName(r.card)}>
                    <button type="button" onClick={() => onInspect(r.card)} className="block w-full"><CardArt card={r.card} sizes="(min-width: 1024px) 160px, 20vw" quality={90} className="rounded-none ring-0 opacity-75" /></button>
                    <EyeButton small card={r.card} preview={preview} onInspect={onInspect} className="absolute left-1 top-1 bg-ink/95 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100" />
                    <span className="num absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-bad px-1 text-[11px] font-bold text-on-accent">
                      ×{r.qty}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] text-t2">{displayName(r.card)}</p>
                  {r.price !== null && <p className="num text-[10px] text-t3">from {formatEur(r.price)}</p>}
                </div>
              ))}
            </div>
          ))}
      </section>
    </div>
  );
}

// ---------- rules checklist ----------

export function RulesPanel({
  checks,
  problems,
  legal,
  stale,
}: {
  checks: { id: string; label: string; detail: string; ok: boolean }[];
  problems: string[];
  legal: boolean;
  stale: boolean;
}) {
  return (
    <details className="group mb-4 rounded-xl border border-line bg-ink" open={!legal}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-t1">Deck rules</span>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            legal ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
          }`}
        >
          {legal ? "✓ Legal" : `${checks.filter((c) => !c.ok).length} to fix`}
        </span>
      </summary>
      <ul className="grid grid-cols-1 gap-x-5 gap-y-1.5 border-t border-line px-3 py-3 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={`mt-px ${c.ok ? "text-ok" : "text-t3"}`} aria-label={c.ok ? "met" : "not met"}>{c.ok ? "✓" : "○"}</span>
            <span className={`flex-1 ${c.ok ? "text-t2" : "text-t1"}`}>{c.label}</span>
            <span className={`num ${c.ok ? "text-t3" : "text-warn"}`}>{c.detail}</span>
          </li>
        ))}
      </ul>
      {problems.length > 0 && (
        <ul className="border-t border-line px-3 py-2 text-xs text-bad">
          {problems.slice(0, 6).map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
          {problems.length > 6 && <li>…and {problems.length - 6} more</li>}
        </ul>
      )}
      {stale && (
        <p className="border-t border-line px-3 py-2 text-[11px] text-t3">
          Press “Sync cards” on the dashboard once to load champion and signature data - until then those two rules aren&apos;t checked.
        </p>
      )}
    </details>
  );
}
