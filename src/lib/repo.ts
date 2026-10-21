// Data access layer shared by all API routes. When SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are configured it talks to Supabase; otherwise
// it falls back to a local JSON file (see localDb.ts) so the app can be
// created/used entirely locally for testing, no Supabase account needed.
// Deploying to Vercel requires the real Supabase env vars - its filesystem
// is ephemeral so the local fallback would lose data between requests.

import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readLocalDb, withLocalDb } from "./localDb";
import { applyCardFixes } from "./cardFixes";
import { getDomainFixes } from "./overrides";
import type { Deck, DeckEntry, Binder, BinderLayout, BinderSlots, BulkMap, BulkVariant, RiftCard, SetInfo } from "./types";

const CHUNK_SIZE = 200;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sortCardsAndSets(cards: RiftCard[], sets: SetInfo[]) {
  cards.sort((a, b) => (a.set.id !== b.set.id ? a.set.id.localeCompare(b.set.id) : (a.collectorNumber ?? 0) - (b.collectorNumber ?? 0)));
  sets.sort((a, b) => a.id.localeCompare(b.id));
  return { cards, sets };
}

type BinderStats = { uniqueCount: number; totalQty: number; contents?: Record<string, number> };

function accumulateStats(
  rows: { binderId: string; cardId: string; qty: number }[]
): Map<string, BinderStats> {
  const byBinder = new Map<string, { contents: Record<string, number>; totalQty: number }>();
  for (const row of rows) {
    const s = byBinder.get(row.binderId) ?? { contents: {}, totalQty: 0 };
    s.contents[row.cardId] = (s.contents[row.cardId] ?? 0) + row.qty;
    s.totalQty += row.qty;
    byBinder.set(row.binderId, s);
  }
  const result = new Map<string, BinderStats>();
  for (const [binderId, s] of byBinder) {
    result.set(binderId, { uniqueCount: Object.keys(s.contents).length, totalQty: s.totalQty, contents: s.contents });
  }
  return result;
}

function toBinder(
  b: { id: string; name: string; layout: string; pageCount: number; sortOrder: number; createdAt: string; setId?: string | null },
  stats: BinderStats
): Binder {
  return {
    id: b.id,
    name: b.name,
    layout: b.layout as BinderLayout,
    pageCount: b.pageCount,
    setId: b.setId ?? null,
    sortOrder: b.sortOrder,
    createdAt: b.createdAt,
    uniqueCount: stats.uniqueCount,
    totalQty: stats.totalQty,
    contents: stats.contents,
  };
}

// Supabase/PostgREST silently caps a single select at 1000 rows, so anything
// that can grow past that has to be read in pages.
async function selectAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// ---------- cards / sets ----------

export async function getCardsAndSets(): Promise<{ cards: RiftCard[]; sets: SetInfo[] }> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [cardRows, { data: setRows, error: setsError }] = await Promise.all([
      selectAll((from, to) => supabase.from("cards").select("payload").order("id").range(from, to)),
      supabase.from("sets").select("id, name, card_count"),
    ]);
    if (setsError) throw new Error(setsError.message);
    const cards = cardRows.map((r) => r.payload as RiftCard);
    const sets = (setRows ?? []).map((r) => ({ id: r.id, name: r.name, cardCount: r.card_count }));
    return sortCardsAndSets(applyCardFixes(cards, await getDomainFixes()), sets);
  }

  const db = await readLocalDb();
  const cards = db.cards.map((c) => c.payload);
  const sets = db.sets.map((s) => ({ id: s.id, name: s.name, cardCount: s.cardCount }));
  return sortCardsAndSets(applyCardFixes(cards, await getDomainFixes()), sets);
}

export async function getExistingCardIds(): Promise<Set<string>> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const rows = await selectAll((from, to) => supabase.from("cards").select("id").order("id").range(from, to));
    return new Set(rows.map((r) => r.id));
  }
  const db = await readLocalDb();
  return new Set(db.cards.map((c) => c.id));
}

export async function upsertCardsAndSets(cards: RiftCard[], sets: SetInfo[]): Promise<void> {
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
      const chunk = cards.slice(i, i + CHUNK_SIZE).map((c) => ({
        id: c.id,
        set_id: c.set.id,
        payload: c,
        updated_at: now,
      }));
      const { error } = await supabase.from("cards").upsert(chunk, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    const { error: setsError } = await supabase
      .from("sets")
      .upsert(sets.map((s) => ({ id: s.id, name: s.name, card_count: s.cardCount, updated_at: now })), {
        onConflict: "id",
      });
    if (setsError) throw new Error(setsError.message);
    return;
  }

  await withLocalDb((db) => {
    const cardMap = new Map(db.cards.map((c) => [c.id, c]));
    for (const c of cards) cardMap.set(c.id, { id: c.id, setId: c.set.id, payload: c, updatedAt: now });
    db.cards = [...cardMap.values()];

    const setMap = new Map(db.sets.map((s) => [s.id, s]));
    for (const s of sets) setMap.set(s.id, { id: s.id, name: s.name, cardCount: s.cardCount, updatedAt: now });
    db.sets = [...setMap.values()];
  });
}

// ---------- bulk ----------

export async function getBulk(): Promise<BulkMap> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("bulk").select("card_id, normal_qty, foil_qty");
    if (error) throw new Error(error.message);
    const map: BulkMap = {};
    for (const row of data ?? []) map[row.card_id] = { normal: row.normal_qty ?? 0, foil: row.foil_qty ?? 0 };
    return map;
  }
  const db = await readLocalDb();
  const map: BulkMap = {};
  for (const row of db.bulk) map[row.cardId] = { normal: row.normalQty, foil: row.foilQty };
  return map;
}

export async function setBulkQty(cardId: string, variant: BulkVariant, qty: number): Promise<void> {
  const now = new Date().toISOString();
  const column = variant === "normal" ? "normal_qty" : "foil_qty";

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    // Omitting the other column from the upsert leaves it untouched on an
    // existing row (Postgres ON CONFLICT DO UPDATE only sets what's listed).
    const { error } = await supabase
      .from("bulk")
      .upsert({ card_id: cardId, [column]: qty, updated_at: now }, { onConflict: "card_id" });
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    const existing = db.bulk.find((r) => r.cardId === cardId);
    if (existing) {
      if (variant === "normal") existing.normalQty = qty;
      else existing.foilQty = qty;
      existing.updatedAt = now;
    } else {
      db.bulk.push({
        cardId,
        normalQty: variant === "normal" ? qty : 0,
        foilQty: variant === "foil" ? qty : 0,
        updatedAt: now,
      });
    }
  });
}

// ---------- binders ----------

export async function listBinders(): Promise<Binder[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [{ data: binders, error: bindersError }, qtyRows] = await Promise.all([
      supabase.from("binders").select("*").order("sort_order").order("created_at"),
      selectAll((from, to) =>
        supabase
          .from("binder_cards")
          .select("binder_id, card_id, qty")
          .gt("qty", 0)
          .order("binder_id")
          .order("position")
          .range(from, to)
      ),
    ]);
    if (bindersError) throw new Error(bindersError.message);

    const stats = accumulateStats(qtyRows.map((r) => ({ binderId: r.binder_id, cardId: r.card_id, qty: r.qty })));
    return (binders ?? []).map((b) =>
      toBinder(
        { id: b.id, name: b.name, layout: b.layout, pageCount: b.page_count, sortOrder: b.sort_order, createdAt: b.created_at, setId: b.set_id ?? null },
        stats.get(b.id) ?? { uniqueCount: 0, totalQty: 0 }
      )
    );
  }

  const db = await readLocalDb();
  const stats = accumulateStats(db.binderCards.filter((r) => r.qty > 0));
  return [...db.binders]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((b) => toBinder(b, stats.get(b.id) ?? { uniqueCount: 0, totalQty: 0 }));
}

const DEFAULT_PAGE_COUNT = 2;

export async function createBinder(name: string, layout: BinderLayout, setId: string | null = null): Promise<Binder> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("binders")
      .insert({ name, layout, page_count: DEFAULT_PAGE_COUNT, ...(setId ? { set_id: setId } : {}) })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toBinder(
      {
        id: data.id,
        name: data.name,
        layout: data.layout,
        pageCount: data.page_count,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
        setId: data.set_id ?? null,
      },
      { uniqueCount: 0, totalQty: 0 }
    );
  }

  const now = new Date().toISOString();
  const binder = {
    id: randomUUID(),
    name,
    layout,
    pageCount: DEFAULT_PAGE_COUNT,
    setId,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await withLocalDb((db) => {
    db.binders.push(binder);
  });
  return toBinder(binder, { uniqueCount: 0, totalQty: 0 });
}

export async function getBinder(id: string): Promise<Binder | null> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [{ data: binder, error: binderError }, { data: qtyRows, error: qtyError }] = await Promise.all([
      supabase.from("binders").select("*").eq("id", id).maybeSingle(),
      supabase.from("binder_cards").select("card_id, qty").eq("binder_id", id).gt("qty", 0),
    ]);
    if (binderError) throw new Error(binderError.message);
    if (!binder) return null;
    if (qtyError) throw new Error(qtyError.message);
    const stats = accumulateStats((qtyRows ?? []).map((r) => ({ binderId: id, cardId: r.card_id, qty: r.qty })));
    return toBinder(
      {
        id: binder.id,
        name: binder.name,
        layout: binder.layout,
        pageCount: binder.page_count,
        sortOrder: binder.sort_order,
        createdAt: binder.created_at,
        setId: binder.set_id ?? null,
      },
      stats.get(id) ?? { uniqueCount: 0, totalQty: 0 }
    );
  }

  const db = await readLocalDb();
  const binder = db.binders.find((b) => b.id === id);
  if (!binder) return null;
  const stats = accumulateStats(db.binderCards.filter((r) => r.binderId === id && r.qty > 0));
  return toBinder(binder, stats.get(id) ?? { uniqueCount: 0, totalQty: 0 });
}

export async function updateBinder(
  id: string,
  patch: { name?: string; layout?: BinderLayout; pageCount?: number; sortOrder?: number; setId?: string | null }
): Promise<Binder | null> {
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.layout !== undefined) update.layout = patch.layout;
    if (patch.pageCount !== undefined) update.page_count = patch.pageCount;
    if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
    if (patch.setId !== undefined) update.set_id = patch.setId;
    const { data, error } = await supabase.from("binders").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return toBinder(
      {
        id: data.id,
        name: data.name,
        layout: data.layout,
        pageCount: data.page_count,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
        setId: data.set_id ?? null,
      },
      { uniqueCount: 0, totalQty: 0 }
    );
  }

  return withLocalDb((db) => {
    const binder = db.binders.find((b) => b.id === id);
    if (!binder) return null;
    if (patch.name !== undefined) binder.name = patch.name;
    if (patch.layout !== undefined) binder.layout = patch.layout;
    if (patch.pageCount !== undefined) binder.pageCount = patch.pageCount;
    if (patch.sortOrder !== undefined) binder.sortOrder = patch.sortOrder;
    if (patch.setId !== undefined) binder.setId = patch.setId;
    binder.updatedAt = now;
    const stats = accumulateStats(db.binderCards.filter((r) => r.binderId === id && r.qty > 0));
    return toBinder(binder, stats.get(id) ?? { uniqueCount: 0, totalQty: 0 });
  });
}

export async function deleteBinder(id: string): Promise<void> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("binders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    db.binders = db.binders.filter((b) => b.id !== id);
    db.binderCards = db.binderCards.filter((r) => r.binderId !== id);
  });
}

// ---------- binder slots ----------

export async function getBinderSlots(binderId: string): Promise<BinderSlots> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("binder_cards")
      .select("position, card_id, qty")
      .eq("binder_id", binderId);
    if (error) throw new Error(error.message);
    const slots: BinderSlots = {};
    for (const row of data ?? []) slots[row.position] = { cardId: row.card_id, qty: row.qty ?? 0 };
    return slots;
  }
  const db = await readLocalDb();
  const slots: BinderSlots = {};
  for (const row of db.binderCards) if (row.binderId === binderId) slots[row.position] = { cardId: row.cardId, qty: row.qty };
  return slots;
}

// qty <= 0 clears the slot (cardId is then ignored).
export async function setBinderSlot(binderId: string, position: number, cardId: string | null, qty: number): Promise<void> {
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    if (qty <= 0 || !cardId) {
      const { error } = await supabase.from("binder_cards").delete().eq("binder_id", binderId).eq("position", position);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await supabase
      .from("binder_cards")
      .upsert(
        { binder_id: binderId, position, card_id: cardId, qty, updated_at: now },
        { onConflict: "binder_id,position" }
      );
    if (error) throw new Error(error.message);
    return;
  }

  await withLocalDb((db) => {
    if (qty <= 0 || !cardId) {
      db.binderCards = db.binderCards.filter((r) => !(r.binderId === binderId && r.position === position));
      return;
    }
    const existing = db.binderCards.find((r) => r.binderId === binderId && r.position === position);
    if (existing) {
      existing.cardId = cardId;
      existing.qty = qty;
      existing.updatedAt = now;
    } else {
      db.binderCards.push({ binderId, position, cardId, qty, updatedAt: now });
    }
  });
}

// ---------- decks ----------

type DeckRow = { id: string; name: string; payload: { entries?: DeckEntry[] } | null; created_at: string; updated_at: string };

function cleanEntries(entries: unknown): DeckEntry[] {
  if (!Array.isArray(entries)) return [];
  const zones = ["legend", "champion", "main", "battlefield", "rune", "sideboard"];
  return entries
    .filter((e) => e && typeof e.cardId === "string" && zones.includes(e.zone) && Number.isFinite(e.qty) && e.qty > 0)
    .map((e) => ({ cardId: e.cardId, zone: e.zone, qty: Math.min(99, Math.floor(e.qty)) }));
}

function fromRow(r: DeckRow): Deck {
  return {
    id: r.id,
    name: r.name,
    entries: cleanEntries(r.payload?.entries),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listDecks(): Promise<Deck[]> {
  if (hasSupabaseConfig()) {
    const { data, error } = await getSupabaseAdmin().from("decks").select("*").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DeckRow[]).map(fromRow);
  }
  const db = await readLocalDb();
  return [...db.decks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDeck(id: string): Promise<Deck | null> {
  if (hasSupabaseConfig()) {
    const { data, error } = await getSupabaseAdmin().from("decks").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as DeckRow) : null;
  }
  const db = await readLocalDb();
  return db.decks.find((d) => d.id === id) ?? null;
}

export async function createDeck(name: string, entries: unknown): Promise<Deck> {
  const clean = cleanEntries(entries);
  if (hasSupabaseConfig()) {
    const { data, error } = await getSupabaseAdmin().from("decks").insert({ name, payload: { entries: clean } }).select("*").single();
    if (error) throw new Error(error.message);
    return fromRow(data as DeckRow);
  }
  const now = new Date().toISOString();
  const deck: Deck = { id: randomUUID(), name, entries: clean, createdAt: now, updatedAt: now };
  await withLocalDb((db) => {
    db.decks.push(deck);
  });
  return deck;
}

export async function updateDeck(id: string, patch: { name?: string; entries?: unknown }): Promise<void> {
  const now = new Date().toISOString();
  if (hasSupabaseConfig()) {
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.entries !== undefined) update.payload = { entries: cleanEntries(patch.entries) };
    const { error } = await getSupabaseAdmin().from("decks").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    const deck = db.decks.find((d) => d.id === id);
    if (!deck) return;
    if (patch.name !== undefined) deck.name = patch.name;
    if (patch.entries !== undefined) deck.entries = cleanEntries(patch.entries);
    deck.updatedAt = now;
  });
}

export async function deleteDeck(id: string): Promise<void> {
  if (hasSupabaseConfig()) {
    const { error } = await getSupabaseAdmin().from("decks").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    db.decks = db.decks.filter((d) => d.id !== id);
  });
}
