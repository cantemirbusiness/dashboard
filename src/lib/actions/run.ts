import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { z } from "zod";
import { fetchWorkspace, getSession, type Session } from "@/lib/data/workspace";
import { ENGINE_VERSION, runEngine } from "@/lib/engine";
import { isPreviewMode } from "@/lib/supabase/env";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./result";
import { check, UserError } from "./db-errors";

export { check, UserError } from "./db-errors";

/**
 * Wrapper for every mutating server action:
 *  1. requires a signed-in user (RLS enforces ownership as well),
 *  2. validates input with the given schema,
 *  3. revalidates the app and records today's progress snapshot afterwards.
 */
export async function mutate<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  fn: (input: z.output<S>, session: Session) => Promise<T>,
): Promise<ActionResult<T>> {
  if (isPreviewMode()) return { ok: false, error: "Preview mode is read-only. Connect Supabase to save changes." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const session = await getSession();
    const data = await fn(parsed.data, session);
    revalidatePath("/", "layout");
    after(() => recordSnapshot(session).catch((e) => console.error("[snapshot]", e)));
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    // redirect() / notFound() throw special errors that must propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Persist today's overall, dimension and per-skill scores (one row per key per day). */
export async function recordSnapshot({ supabase, userId }: Session) {
  const ws = await fetchWorkspace(supabase, userId);
  const { analysis } = runEngine(ws);
  const rows: { user_id: string; snapshot_on: string; key: string; score: number; engine_version: string }[] = [];
  const push = (key: string, score: number) =>
    rows.push({ user_id: userId, snapshot_on: ws.today, key, score: Math.round(score * 100) / 100, engine_version: ENGINE_VERSION });
  if (analysis.overall.score != null) push("overall", analysis.overall.score);
  for (const [k, v] of Object.entries(analysis.dimensions.current)) push(`dim:${k}`, v);
  for (const s of analysis.skills) push(`skill:${s.skill.id}`, s.score);
  if (rows.length === 0) return;
  const { error } = await supabase.from("progress_snapshots").upsert(rows, { onConflict: "user_id,snapshot_on,key" });
  if (error) console.error("[snapshot]", error);
}

/** Replace the rows of a join table for one parent. */
export async function replaceLinks(
  session: Session,
  table: string,
  parentKey: string,
  parentId: string,
  childKey: string,
  childIds: string[],
) {
  const { supabase, userId } = session;
  check(await supabase.from(table).delete().eq(parentKey, parentId).eq("user_id", userId), `update ${table}`);
  if (childIds.length) {
    check(
      await supabase.from(table).insert(childIds.map((c) => ({ user_id: userId, [parentKey]: parentId, [childKey]: c }))),
      `update ${table}`,
    );
  }
}
