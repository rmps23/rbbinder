// Small key/value store for generated reference data (Cardmarket links, finish
// availability, domain fixes). Lives in the database so the Maintenance page can
// refresh it on Vercel, where the filesystem is read-only.

import { getSupabaseAdmin } from "./supabaseAdmin";
import { readLocalDb, withLocalDb } from "./localDb";

export type AppDataKey = "cardmarketMap" | "finishes" | "domainFixes" | "metaDecks";

const hasSupabaseConfig = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const cache = new Map<string, { at: number; row: { value: unknown; updatedAt: string } | null }>();
const TTL_MS = 60_000;

export async function getAppData<T>(key: AppDataKey): Promise<{ value: T; updatedAt: string } | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row as { value: T; updatedAt: string } | null;

  let row: { value: unknown; updatedAt: string } | null = null;
  try {
    if (hasSupabaseConfig()) {
      const { data, error } = await getSupabaseAdmin().from("app_data").select("value, updated_at").eq("key", key).maybeSingle();
      // A missing table just means nothing was ever saved - use the bundled defaults.
      if (!error && data) row = { value: data.value, updatedAt: data.updated_at };
    } else {
      const found = (await readLocalDb()).appData.find((r) => r.key === key);
      if (found) row = { value: found.value, updatedAt: found.updatedAt };
    }
  } catch {
    row = null;
  }
  cache.set(key, { at: Date.now(), row });
  return row as { value: T; updatedAt: string } | null;
}

export async function setAppData(key: AppDataKey, value: unknown): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (hasSupabaseConfig()) {
    const { error } = await getSupabaseAdmin().from("app_data").upsert({ key, value, updated_at: updatedAt }, { onConflict: "key" });
    if (error) {
      const missing = /app_data/i.test(error.message) && /(relation|schema cache|does not exist|find the table)/i.test(error.message);
      throw new Error(
        missing ? "The app_data table doesn't exist yet - run supabase/schema.sql in the Supabase SQL editor." : error.message
      );
    }
  } else {
    await withLocalDb((db) => {
      const existing = db.appData.find((r) => r.key === key);
      if (existing) {
        existing.value = value;
        existing.updatedAt = updatedAt;
      } else db.appData.push({ key, value, updatedAt });
    });
  }
  cache.set(key, { at: Date.now(), row: { value, updatedAt } });
}
