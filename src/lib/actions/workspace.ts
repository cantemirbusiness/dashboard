"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { todayIn } from "@/lib/dates";
import { clearDemoRows, seedDemoData } from "@/lib/demo/seed-db";
import { SKILL_TEMPLATES } from "@/lib/templates";
import { timezoneSchema } from "@/lib/validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "./result";
import { check, mutate, UserError } from "./run";

/**
 * Finish onboarding and adopt the browser's timezone, so "today" (streaks,
 * default dates) matches where the user lives instead of UTC.
 */
async function finishOnboarding(supabase: SupabaseClient, userId: string, timezone: string | undefined) {
  check(
    await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString(), ...(timezone ? { timezone } : {}) })
      .eq("id", userId),
    "finish onboarding",
  );
}

const onboardingSchema = z.object({ timezone: timezoneSchema.optional() });

/** Load the demo workspace into the user's account (flagged is_demo). */
export async function loadDemoData(input: { timezone?: string } = {}): Promise<ActionResult> {
  const result = await mutate(onboardingSchema, input, async ({ timezone }, { supabase, userId }) => {
    const existing = await supabase.from("skills").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_demo", true);
    if ((existing.count ?? 0) > 0) throw new UserError("Demo data is already loaded.");
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    try {
      await seedDemoData(supabase, userId, todayIn(timezone ?? profile?.timezone ?? "UTC"));
    } catch (e) {
      // Don't leave a half-seeded workspace behind (it would also block a retry).
      await clearDemoRows(supabase, userId).catch((err) => console.error("[demo] cleanup failed", err));
      throw e;
    }
    await finishOnboarding(supabase, userId, timezone);
    return undefined;
  });
  if (result.ok) redirect("/");
  return result;
}

/** Delete every demo record. Real records are untouched (links to demo items are removed). */
export async function clearDemoData(): Promise<ActionResult> {
  return mutate(z.object({}), {}, async (_input, { supabase, userId }) => {
    await clearDemoRows(supabase, userId);
    return undefined;
  });
}

const startSchema = onboardingSchema.extend({ templates: z.array(z.string().max(40)).max(10) });

/** Start with a clean workspace, optionally pre-filled with starter skills. */
export async function startFresh(input: { templates: string[]; timezone?: string }): Promise<ActionResult> {
  const result = await mutate(startSchema, input, async ({ templates, timezone }, { supabase, userId }) => {
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const today = todayIn(timezone ?? profile?.timezone ?? "UTC");
    const chosen = SKILL_TEMPLATES.filter((t) => templates.includes(t.key));
    for (const [i, t] of chosen.entries()) {
      const cat = await supabase
        .from("skill_categories")
        .upsert({ user_id: userId, name: t.name, color: t.color, sort_order: i }, { onConflict: "user_id,name" })
        .select("id")
        .single();
      check(cat, "create starter categories");
      const rows = t.skills.map((name) => ({
        user_id: userId,
        category_id: cat.data!.id,
        name,
        baseline_score: 10,
        target_score: 70,
        tracked_since: today,
      }));
      check(await supabase.from("skills").upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true }), "create starter skills");
    }
    await finishOnboarding(supabase, userId, timezone);
    return undefined;
  });
  if (result.ok) redirect("/");
  return result;
}
