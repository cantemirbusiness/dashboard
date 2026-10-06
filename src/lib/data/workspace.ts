import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "@/lib/domain";
import { todayIn } from "@/lib/dates";
import { fetchWorkspace } from "./fetch";
import { demoWorkspace } from "@/lib/demo/workspace";
import { runEngine, type EngineResult } from "@/lib/engine";
import { isPreviewMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface Session {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
}

/** The signed-in user. Redirects to /login when there is no valid session. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { supabase, userId: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** The current user's workspace, loaded once per request. */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  if (isPreviewMode()) return demoWorkspace(todayIn("UTC"));
  const { supabase, userId } = await getSession();
  return fetchWorkspace(supabase, userId);
});

/** Workspace + Progress Engine output, computed once per request. */
export const getEngine = cache(async (): Promise<{ ws: Workspace; engine: EngineResult }> => {
  const ws = await getWorkspace();
  return { ws, engine: runEngine(ws) };
});

export const getUserEmail = cache(async (): Promise<string | null> => {
  if (isPreviewMode()) return "preview@localhost";
  return (await getSession()).email;
});

export { fetchWorkspace };
