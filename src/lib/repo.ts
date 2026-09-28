// Data access layer shared by all API routes. When SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are configured it talks to Supabase; otherwise
// it falls back to a local JSON file (see localDb.ts) so the app can be
// created/used entirely locally for testing, no Supabase account needed.
// Deploying to Vercel requires the real Supabase env vars - its filesystem
// is ephemeral so the local fallback would lose data between requests.

import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readLocalDb, withLocalDb } from "./localDb";
import type { Binder, BinderLayout, QtyMap, RiftCard, SetInfo } from "./types";

const CHUNK_SIZE = 200;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sortCardsAndSets(cards: RiftCard[], sets: SetInfo[]) {
  cards.sort((a, b) => (a.set.id !== b.set.id ? a.set.id.localeCompare(b.set.id) : (a.collectorNumber ?? 0) - (b.collectorNumber ?? 0)));
  sets.sort((a, b) => a.id.localeCompare(b.id));
  return { cards, sets };
}

function toBinder(
  b: { id: string; name: string; layout: string; sortOrder: number; createdAt: string },
  stats: { uniqueCount: number; totalQty: number }
): Binder {
  return {
    id: b.id,
    name: b.name,
    layout: b.layout as BinderLayout,
    sortOrder: b.sortOrder,
    createdAt: b.createdAt,
    uniqueCount: stats.uniqueCount,
    totalQty: stats.totalQty,
  };
}

// ---------- cards / sets ----------

export async function getCardsAndSets(): Promise<{ cards: RiftCard[]; sets: SetInfo[] }> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [{ data: cardRows, error: cardsError }, { data: setRows, error: setsError }] = await Promise.all([
      supabase.from("cards").select("payload"),
      supabase.from("sets").select("id, name, card_count"),
    ]);
    if (cardsError) throw new Error(cardsError.message);
    if (setsError) throw new Error(setsError.message);
    const cards = (cardRows ?? []).map((r) => r.payload as RiftCard);
    const sets = (setRows ?? []).map((r) => ({ id: r.id, name: r.name, cardCount: r.card_count }));
    return sortCardsAndSets(cards, sets);
  }

  const db = await readLocalDb();
  const cards = db.cards.map((c) => c.payload);
  const sets = db.sets.map((s) => ({ id: s.id, name: s.name, cardCount: s.cardCount }));
  return sortCardsAndSets(cards, sets);
}

export async function getExistingCardIds(): Promise<Set<string>> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("cards").select("id");
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => r.id));
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

export async function getBulk(): Promise<QtyMap> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("bulk").select("card_id, qty");
    if (error) throw new Error(error.message);
    const map: QtyMap = {};
    for (const row of data ?? []) map[row.card_id] = row.qty ?? 0;
    return map;
  }
  const db = await readLocalDb();
  const map: QtyMap = {};
  for (const row of db.bulk) map[row.cardId] = row.qty;
  return map;
}

export async function setBulkQty(cardId: string, qty: number): Promise<void> {
  const now = new Date().toISOString();
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("bulk")
      .upsert({ card_id: cardId, qty, updated_at: now }, { onConflict: "card_id" });
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    const existing = db.bulk.find((r) => r.cardId === cardId);
    if (existing) {
      existing.qty = qty;
      existing.updatedAt = now;
    } else {
      db.bulk.push({ cardId, qty, updatedAt: now });
    }
  });
}

// ---------- binders ----------

export async function listBinders(): Promise<Binder[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [{ data: binders, error: bindersError }, { data: qtyRows, error: qtyError }] = await Promise.all([
      supabase.from("binders").select("*").order("sort_order").order("created_at"),
      supabase.from("binder_cards").select("binder_id, qty").gt("qty", 0),
    ]);
    if (bindersError) throw new Error(bindersError.message);
    if (qtyError) throw new Error(qtyError.message);

    const stats = new Map<string, { uniqueCount: number; totalQty: number }>();
    for (const row of qtyRows ?? []) {
      const s = stats.get(row.binder_id) ?? { uniqueCount: 0, totalQty: 0 };
      s.uniqueCount += 1;
      s.totalQty += row.qty;
      stats.set(row.binder_id, s);
    }
    return (binders ?? []).map((b) =>
      toBinder(
        { id: b.id, name: b.name, layout: b.layout, sortOrder: b.sort_order, createdAt: b.created_at },
        stats.get(b.id) ?? { uniqueCount: 0, totalQty: 0 }
      )
    );
  }

  const db = await readLocalDb();
  const stats = new Map<string, { uniqueCount: number; totalQty: number }>();
  for (const row of db.binderCards) {
    if (row.qty <= 0) continue;
    const s = stats.get(row.binderId) ?? { uniqueCount: 0, totalQty: 0 };
    s.uniqueCount += 1;
    s.totalQty += row.qty;
    stats.set(row.binderId, s);
  }
  return [...db.binders]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((b) => toBinder(b, stats.get(b.id) ?? { uniqueCount: 0, totalQty: 0 }));
}

export async function createBinder(name: string, layout: BinderLayout): Promise<Binder> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("binders").insert({ name, layout }).select("*").single();
    if (error) throw new Error(error.message);
    return toBinder(
      { id: data.id, name: data.name, layout: data.layout, sortOrder: data.sort_order, createdAt: data.created_at },
      { uniqueCount: 0, totalQty: 0 }
    );
  }

  const now = new Date().toISOString();
  const binder = { id: randomUUID(), name, layout, sortOrder: 0, createdAt: now, updatedAt: now };
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
      supabase.from("binder_cards").select("qty").eq("binder_id", id).gt("qty", 0),
    ]);
    if (binderError) throw new Error(binderError.message);
    if (!binder) return null;
    if (qtyError) throw new Error(qtyError.message);
    return toBinder(
      { id: binder.id, name: binder.name, layout: binder.layout, sortOrder: binder.sort_order, createdAt: binder.created_at },
      { uniqueCount: qtyRows?.length ?? 0, totalQty: (qtyRows ?? []).reduce((sum, r) => sum + r.qty, 0) }
    );
  }

  const db = await readLocalDb();
  const binder = db.binders.find((b) => b.id === id);
  if (!binder) return null;
  const rows = db.binderCards.filter((r) => r.binderId === id && r.qty > 0);
  return toBinder(binder, { uniqueCount: rows.length, totalQty: rows.reduce((sum, r) => sum + r.qty, 0) });
}

export async function updateBinder(
  id: string,
  patch: { name?: string; layout?: BinderLayout; sortOrder?: number }
): Promise<Binder | null> {
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.layout !== undefined) update.layout = patch.layout;
    if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
    const { data, error } = await supabase.from("binders").update(update).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return toBinder(
      { id: data.id, name: data.name, layout: data.layout, sortOrder: data.sort_order, createdAt: data.created_at },
      { uniqueCount: 0, totalQty: 0 }
    );
  }

  return withLocalDb((db) => {
    const binder = db.binders.find((b) => b.id === id);
    if (!binder) return null;
    if (patch.name !== undefined) binder.name = patch.name;
    if (patch.layout !== undefined) binder.layout = patch.layout;
    if (patch.sortOrder !== undefined) binder.sortOrder = patch.sortOrder;
    binder.updatedAt = now;
    const rows = db.binderCards.filter((r) => r.binderId === id && r.qty > 0);
    return toBinder(binder, { uniqueCount: rows.length, totalQty: rows.reduce((sum, r) => sum + r.qty, 0) });
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

// ---------- binder cards ----------

export async function getBinderCards(binderId: string): Promise<QtyMap> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("binder_cards").select("card_id, qty").eq("binder_id", binderId);
    if (error) throw new Error(error.message);
    const map: QtyMap = {};
    for (const row of data ?? []) map[row.card_id] = row.qty ?? 0;
    return map;
  }
  const db = await readLocalDb();
  const map: QtyMap = {};
  for (const row of db.binderCards) if (row.binderId === binderId) map[row.cardId] = row.qty;
  return map;
}

export async function setBinderCardQty(binderId: string, cardId: string, qty: number): Promise<void> {
  const now = new Date().toISOString();
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("binder_cards")
      .upsert({ binder_id: binderId, card_id: cardId, qty, updated_at: now }, { onConflict: "binder_id,card_id" });
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    const existing = db.binderCards.find((r) => r.binderId === binderId && r.cardId === cardId);
    if (existing) {
      existing.qty = qty;
      existing.updatedAt = now;
    } else {
      db.binderCards.push({ binderId, cardId, qty, updatedAt: now });
    }
  });
}
