"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** Browser client that stores the session in cookies the server can read. */
export function createBrowserSupabase() {
  const { url, key } = requireSupabaseEnv();
  // URL handling is done explicitly by /auth/confirm, not automatically.
  return createBrowserClient(url, key, { auth: { detectSessionInUrl: false } });
}
