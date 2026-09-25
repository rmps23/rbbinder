import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Service-role Supabase client. Only ever import this from server-side
// route handlers - it must never be sent to the browser.
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars are not set");
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}
