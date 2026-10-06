import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

/**
 * Client used ONLY to send emails that contain links (sign-up confirmation,
 * magic link, password reset).
 *
 * Why not the regular SSR client: it uses the PKCE flow, whose email links
 * only work in the same browser that requested them (the code verifier lives
 * in that browser's cookies). People routinely sign up on a laptop and tap
 * the link on their phone, which then fails with "link invalid".
 *
 * With the implicit flow, Supabase redirects back with the session in the URL
 * fragment, so the link works on any device. The fragment never reaches a
 * server; /auth/confirm (a client page) reads it and stores the session in
 * cookies. No session is persisted here.
 */
export function createEmailLinkClient() {
  const { url, key } = requireSupabaseEnv();
  return createClient(url, key, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
