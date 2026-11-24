// Data access layer shared by all API routes. When SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are configured it talks to Supabase; otherwise
// it falls back to a local JSON file (see localDb.ts) so the app can be
// created/used entirely locally for testing, no Supabase account needed.
// Deploying to Vercel requires the real Supabase env vars - its filesystem
// is ephemeral so the local fallback would lose data between requests.
//
// Binders, bulk and decks belong to a user: every function for them takes the
// signed-in user's id (see session.ts) and only touches that user's rows. The
// local file has a single user, so there the id is ignored.

import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { readLocalDb, withLocalDb, type LocalDeck } from "./localDb";
import { applyCardFixes } from "./cardFixes";
import { getDomainFixes, getTypeFixes } from "./overrides";
import type { Deck, DeckEntry, Binder, BinderLayout, BinderSlots, BulkMap, BulkVariant, RiftCard, SetInfo, Match, MatchResult, MatchSummary, SideCard } from "./types";

const CHUNK_SIZE = 200;

// The single user of the password-only mode (no accounts, see session.ts). With
// Supabase behind it, that mode works on every row like before accounts existed.
export const LOCAL_USER = "local";

// Only this user's rows (every row for the password-only user).
function mine<Q>(query: Q, userId: string): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return userId === LOCAL_USER ? query : (query as any).eq("user_id", userId);
}
const owner = (userId: string) => (userId === LOCAL_USER ? {} : { user_id: userId });

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
    return sortCardsAndSets(applyCardFixes(cards, await getDomainFixes(), await getTypeFixes()), sets);
  }

  const db = await readLocalDb();
  const cards = db.cards.map((c) => c.payload);
  const sets = db.sets.map((s) => ({ id: s.id, name: s.name, cardCount: s.cardCount }));
  return sortCardsAndSets(applyCardFixes(cards, await getDomainFixes(), await getTypeFixes()), sets);
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

export async function getBulk(userId: string): Promise<BulkMap> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await mine(supabase.from("bulk").select("card_id, normal_qty, foil_qty"), userId);
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

export async function setBulkQty(userId: string, cardId: string, variant: BulkVariant, qty: number): Promise<void> {
  const now = new Date().toISOString();
  const column = variant === "normal" ? "normal_qty" : "foil_qty";

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    // Omitting the other column from the upsert leaves it untouched on an
    // existing row (Postgres ON CONFLICT DO UPDATE only sets what's listed).
    const { error } = await supabase
      .from("bulk")
      .upsert(
        { ...owner(userId), card_id: cardId, [column]: qty, updated_at: now },
        { onConflict: userId === LOCAL_USER ? "card_id" : "user_id,card_id" }
      );
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

export async function listBinders(userId: string): Promise<Binder[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data: binders, error: bindersError } = await mine(supabase.from("binders").select("*"), userId)
      .order("sort_order")
      .order("created_at");
    if (bindersError) throw new Error(bindersError.message);
    const ids = (binders ?? []).map((b) => b.id);
    const qtyRows = ids.length
      ? await selectAll((from, to) =>
          supabase
            .from("binder_cards")
            .select("binder_id, card_id, qty")
            .in("binder_id", ids)
            .gt("qty", 0)
            .order("binder_id")
            .order("position")
            .range(from, to)
        )
      : [];

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

export async function createBinder(userId: string, name: string, layout: BinderLayout, setId: string | null = null): Promise<Binder> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("binders")
      .insert({ ...owner(userId), name, layout, page_count: DEFAULT_PAGE_COUNT, ...(setId ? { set_id: setId } : {}) })
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

export async function getBinder(userId: string, id: string): Promise<Binder | null> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const [{ data: binder, error: binderError }, { data: qtyRows, error: qtyError }] = await Promise.all([
      mine(supabase.from("binders").select("*").eq("id", id), userId).maybeSingle(),
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
  userId: string,
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
    const { data, error } = await mine(supabase.from("binders").update(update).eq("id", id), userId).select("*").maybeSingle();
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

export async function deleteBinder(userId: string, id: string): Promise<void> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const { error } = await mine(supabase.from("binders").delete().eq("id", id), userId);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    db.binders = db.binders.filter((b) => b.id !== id);
    db.binderCards = db.binderCards.filter((r) => r.binderId !== id);
  });
}

// ---------- binder slots ----------

// binder_cards has no owner column: a binder's slots belong to the binder's owner.
async function ownsBinder(userId: string, binderId: string): Promise<boolean> {
  const { data, error } = await mine(getSupabaseAdmin().from("binders").select("id").eq("id", binderId), userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getBinderSlots(userId: string, binderId: string): Promise<BinderSlots> {
  if (hasSupabaseConfig()) {
    if (!(await ownsBinder(userId, binderId))) return {};
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
export async function setBinderSlot(
  userId: string,
  binderId: string,
  position: number,
  cardId: string | null,
  qty: number
): Promise<void> {
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    if (!(await ownsBinder(userId, binderId))) throw new Error("Binder not found");
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

type DeckRow = { id: string; name: string; payload: { entries?: DeckEntry[]; familyId?: string; version?: number } | null; created_at: string; updated_at: string };

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
    familyId: r.payload?.familyId ?? r.id,
    version: r.payload?.version ?? 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const fromLocal = (d: LocalDeck): Deck => ({ ...d, familyId: d.familyId ?? d.id, version: d.version ?? 1 });

export async function listDecks(userId: string): Promise<Deck[]> {
  if (hasSupabaseConfig()) {
    const { data, error } = await mine(getSupabaseAdmin().from("decks").select("*"), userId).order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DeckRow[]).map(fromRow);
  }
  const db = await readLocalDb();
  return db.decks.map(fromLocal).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDeck(userId: string, id: string): Promise<Deck | null> {
  if (hasSupabaseConfig()) {
    const { data, error } = await mine(getSupabaseAdmin().from("decks").select("*").eq("id", id), userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as DeckRow) : null;
  }
  const db = await readLocalDb();
  const deck = db.decks.find((d) => d.id === id);
  return deck ? fromLocal(deck) : null;
}

// `versionOf`: an existing deck this one is the next version of (it takes its name).
// null = that deck doesn't exist.
export async function createDeck(userId: string, name: string, entries: unknown, versionOf?: string): Promise<Deck | null> {
  const clean = cleanEntries(entries);
  let family: { familyId: string; version: number } | undefined;
  if (versionOf) {
    const decks = await listDecks(userId);
    const base = decks.find((d) => d.id === versionOf);
    if (!base) return null;
    const versions = decks.filter((d) => d.familyId === base.familyId);
    family = { familyId: base.familyId, version: Math.max(...versions.map((d) => d.version)) + 1 };
    name = base.name;
  }
  if (hasSupabaseConfig()) {
    const { data, error } = await getSupabaseAdmin().from("decks").insert({ ...owner(userId), name, payload: { entries: clean, ...family } }).select("*").single();
    if (error) throw new Error(error.message);
    return fromRow(data as DeckRow);
  }
  const now = new Date().toISOString();
  const deck: LocalDeck = { id: randomUUID(), name, entries: clean, ...family, createdAt: now, updatedAt: now };
  await withLocalDb((db) => {
    db.decks.push(deck);
  });
  return fromLocal(deck);
}

export async function updateDeck(userId: string, id: string, patch: { name?: string; entries?: unknown }): Promise<void> {
  const now = new Date().toISOString();
  const decks = await listDecks(userId);
  const current = decks.find((d) => d.id === id);
  if (!current) return;
  // A deck's versions share its name.
  const renamed = patch.name !== undefined && patch.name !== current.name ? decks.filter((d) => d.familyId === current.familyId).map((d) => d.id) : [];
  if (hasSupabaseConfig()) {
    const update: Record<string, unknown> = { updated_at: now };
    // the payload is replaced whole: keep which version it is
    const version = current.familyId !== current.id ? { familyId: current.familyId, version: current.version } : {};
    if (patch.entries !== undefined) update.payload = { entries: cleanEntries(patch.entries), ...version };
    const { error } = await mine(getSupabaseAdmin().from("decks").update(update).eq("id", id), userId);
    if (error) throw new Error(error.message);
    if (renamed.length) {
      const { error: nameError } = await mine(getSupabaseAdmin().from("decks").update({ name: patch.name }).in("id", renamed), userId);
      if (nameError) throw new Error(nameError.message);
    }
    return;
  }
  await withLocalDb((db) => {
    const deck = db.decks.find((d) => d.id === id);
    if (!deck) return;
    for (const d of db.decks) if (patch.name !== undefined && renamed.includes(d.id)) d.name = patch.name;
    if (patch.entries !== undefined) deck.entries = cleanEntries(patch.entries);
    deck.updatedAt = now;
  });
}

export async function deleteDeck(userId: string, id: string): Promise<void> {
  if (hasSupabaseConfig()) {
    const { error } = await mine(getSupabaseAdmin().from("decks").delete().eq("id", id), userId);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    db.decks = db.decks.filter((d) => d.id !== id);
  });
}

// ---------- match history ----------

type MatchRow = { id: string; deck_id: string | null; played_at: string; summary: MatchSummary; notes: string | null };

function toMatch(r: MatchRow): Match {
  // The first imports saved "ROOM:series start"; the start alone is what a series shares.
  const summary = { ...r.summary, seriesId: r.summary.seriesId.replace(/^\w+:(?=\d+$)/, "") };
  return { id: r.id, deckId: r.deck_id, playedAt: r.played_at, result: r.summary.result, notes: r.notes ?? "", summary };
}

export async function listMatches(userId: string): Promise<Match[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdmin();
    const rows = await selectAll<MatchRow>((from, to) =>
      mine(supabase.from("matches").select("id, deck_id, played_at, summary, notes"), userId)
        .order("played_at", { ascending: false })
        .order("id")
        .range(from, to)
    );
    return rows.map(toMatch);
  }
  const db = await readLocalDb();
  return db.matches
    .map((m) => toMatch({ id: m.id, deck_id: m.deckId, played_at: m.playedAt, summary: m.summary, notes: m.notes }))
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

// Saves the games that aren't there yet; returns how many were new.
export async function addMatches(userId: string, items: { summary: MatchSummary; deckId: string | null }[]): Promise<number> {
  const known = new Set((await listMatches(userId)).map((m) => m.summary.replayId));
  const fresh = [...new Map(items.map((i) => [i.summary.replayId, i])).values()].filter((i) => !known.has(i.summary.replayId));
  if (!fresh.length) return 0;

  if (hasSupabaseConfig()) {
    const { error } = await getSupabaseAdmin()
      .from("matches")
      .insert(
        fresh.map((i) => ({
          ...owner(userId),
          replay_id: i.summary.replayId,
          deck_id: i.deckId,
          played_at: i.summary.playedAt,
          summary: i.summary,
        }))
      );
    if (error) throw new Error(error.message);
    return fresh.length;
  }
  await withLocalDb((db) => {
    for (const i of fresh) {
      db.matches.push({
        id: randomUUID(),
        replayId: i.summary.replayId,
        deckId: i.deckId,
        playedAt: i.summary.playedAt,
        summary: i.summary,
        notes: "",
      });
    }
  });
  return fresh.length;
}

type SummaryPatch = { result?: MatchResult; sideIn?: SideCard[] };

// Setting the result by hand settles a guessed one.
const patchSummary = (summary: MatchSummary, { result, sideIn }: SummaryPatch): MatchSummary => ({
  ...summary,
  ...(result !== undefined ? { result, inferred: false } : {}),
  ...(sideIn !== undefined ? { sideIn } : {}),
});

export async function updateMatch(
  userId: string,
  id: string,
  patch: { deckId?: string | null; notes?: string } & SummaryPatch
): Promise<void> {
  const inSummary = patch.result !== undefined || patch.sideIn !== undefined;
  if (hasSupabaseConfig()) {
    const update: Record<string, unknown> = {};
    if (inSummary) {
      const { data, error } = await mine(getSupabaseAdmin().from("matches").select("summary").eq("id", id), userId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return;
      update.summary = patchSummary(data.summary as MatchSummary, patch);
    }
    if (patch.deckId !== undefined) update.deck_id = patch.deckId;
    if (patch.notes !== undefined) update.notes = patch.notes;
    const { error } = await mine(getSupabaseAdmin().from("matches").update(update).eq("id", id), userId);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    const m = db.matches.find((x) => x.id === id);
    if (!m) return;
    if (inSummary) m.summary = patchSummary(m.summary, patch);
    if (patch.deckId !== undefined) m.deckId = patch.deckId;
    if (patch.notes !== undefined) m.notes = patch.notes;
  });
}

export async function deleteMatch(userId: string, id: string): Promise<void> {
  if (hasSupabaseConfig()) {
    const { error } = await mine(getSupabaseAdmin().from("matches").delete().eq("id", id), userId);
    if (error) throw new Error(error.message);
    return;
  }
  await withLocalDb((db) => {
    db.matches = db.matches.filter((x) => x.id !== id);
  });
}
