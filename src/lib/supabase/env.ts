// Public Supabase settings. Both values are safe to expose to the browser:
// access control is enforced by Row Level Security, not by hiding the key.
// The service-role key is never used by this app.

export interface SupabaseEnv {
  url: string;
  key: string;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return env;
}

/**
 * UI preview mode: renders the app with in-memory demo data and no backend.
 * Only ever active in `next dev` — it is ignored in production builds.
 */
export function isPreviewMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.PREVIEW_MODE === "demo";
}
