"use client";

import { createBrowserClient } from "@supabase/ssr";

// Supabase client for the browser - only used for signing in/up/out. All data
// still goes through the app's own API routes.
export const accountsEnabledInBrowser = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let client: ReturnType<typeof createBrowserClient> | null = null;
export function supabaseBrowser() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
