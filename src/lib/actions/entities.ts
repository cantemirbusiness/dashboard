"use server";

// Create / update / delete actions for every entity. Each one goes through
// `mutate`, which authenticates, validates and revalidates. All queries run
// with the user's own session, so Row Level Security applies to every call.

import { z } from "zod";
import { todayIn } from "@/lib/dates";
import {
  activitySchema,
  categorySchema,
  evidenceSchema,
  goalSchema,
  milestoneSchema,
  profileSchema,
  projectSchema,
  skillSchema,
  type ActivityInput,
  type CategoryInput,
  type EvidenceInput,
  type GoalInput,
  type MilestoneInput,
  type ProfileInput,
  type ProjectInput,
  type SkillInput,
} from "@/lib/validation";
import type { ActionResult } from "./result";
import { check, mutate, replaceLinks } from "./run";

const idOnly = z.object({ id: z.uuid() });

async function userToday(session: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data } = await session.supabase.from("profiles").select("timezone").eq("id", session.userId).maybeSingle();
  return todayIn(data?.timezone ?? "UTC");
}

// ---- Activities --------------------------------------------------------------

export async function saveActivity(input: ActivityInput): Promise<ActionResult<{ id: string }>> {
  return mutate(activitySchema, input, async (a, session) => {
    const { supabase, userId } = session;
    const row = {
      user_id: userId,
      occurred_on: a.occurredOn,
      title: a.title,
      description: a.description,
      type: a.type,
      mode: a.mode,
      project_id: a.projectId,
      duration_minutes: a.durationMinutes,
      difficulty: a.difficulty,
      outcome: a.outcome,
      notes: a.notes,
    };
    let id = a.id;
    if (id) {
      check(await supabase.from("activities").update(row).eq("id", id).eq("user_id", userId), "update the activity");
    } else {
      const res = check(await supabase.from("activities").insert(row).select("id").single(), "save the activity");
      id = res.data!.id as string;
    }
    await replaceLinks(session, "activity_skills", "activity_id", id, "skill_id", a.skillIds);

    if (a.evidence) {
      const ev = check(
        await supabase
          .from("evidence")
          .insert({
            user_id: userId,
            title: a.evidence.title,
            kind: a.evidence.kind,
            url: a.evidence.url,
            occurred_on: a.occurredOn,
            activity_id: id,
            project_id: a.projectId,
          })
          .select("id")
          .single(),
        "save the evidence",
      );
      if (a.skillIds.length) {
        check(
          await supabase
            .from("evidence_skills")
            .insert(a.skillIds.map((s) => ({ user_id: userId, evidence_id: ev.data!.id, skill_id: s }))),
          "link the evidence",
        );
      }
    }
    return { id };
  });
}

export async function deleteActivity(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("activities").delete().eq("id", id).eq("user_id", userId), "delete the activity");
    return undefined;
  });
}

// ---- Categories & skills -----------------------------------------------------

export async function saveCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  return mutate(categorySchema, input, async (c, { supabase, userId }) => {
    if (c.id) {
      check(
        await supabase.from("skill_categories").update({ name: c.name, color: c.color }).eq("id", c.id).eq("user_id", userId),
        "update the category",
      );
      return { id: c.id };
    }
    const { count } = await supabase.from("skill_categories").select("id", { count: "exact", head: true }).eq("user_id", userId);
    const res = check(
      await supabase
        .from("skill_categories")
        .insert({ user_id: userId, name: c.name, color: c.color, sort_order: count ?? 0 })
        .select("id")
        .single(),
      "create the category",
    );
    return { id: res.data!.id as string };
  });
}

export async function deleteCategory(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("skill_categories").delete().eq("id", id).eq("user_id", userId), "delete the category");
    return undefined;
  });
}

export async function saveSkill(input: SkillInput): Promise<ActionResult<{ id: string }>> {
  return mutate(skillSchema, input, async (s, { supabase, userId }) => {
    const row = {
      user_id: userId,
      name: s.name,
      category_id: s.categoryId,
      description: s.description,
      baseline_score: s.baselineScore,
      target_score: s.targetScore,
      tracked_since: s.trackedSince,
      archived: s.archived,
    };
    if (s.id) {
      check(await supabase.from("skills").update(row).eq("id", s.id).eq("user_id", userId), "update the skill");
      return { id: s.id };
    }
    const res = check(await supabase.from("skills").insert(row).select("id").single(), "create the skill");
    return { id: res.data!.id as string };
  });
}

export async function deleteSkill(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("skills").delete().eq("id", id).eq("user_id", userId), "delete the skill");
    return undefined;
  });
}

// ---- Projects ----------------------------------------------------------------

export async function saveProject(input: ProjectInput): Promise<ActionResult<{ id: string }>> {
  return mutate(projectSchema, input, async (p, session) => {
    const { supabase, userId } = session;
    const completedOn = p.status === "completed" ? p.completedOn ?? (await userToday(session)) : null;
    const row = {
      user_id: userId,
      name: p.name,
      description: p.description,
      status: p.status,
      manual_progress: p.status === "completed" ? 100 : p.manualProgress,
      start_date: p.startDate,
      target_date: p.targetDate,
      completed_on: completedOn,
      output: p.output,
      notes: p.notes,
      links: p.links,
    };
    let id = p.id;
    if (id) {
      check(await supabase.from("projects").update(row).eq("id", id).eq("user_id", userId), "update the project");
    } else {
      const res = check(await supabase.from("projects").insert(row).select("id").single(), "create the project");
      id = res.data!.id as string;
    }
    await replaceLinks(session, "project_skills", "project_id", id, "skill_id", p.skillIds);
    check(await supabase.from("project_tracks").delete().eq("project_id", id).eq("user_id", userId), "update tracks");
    if (p.tracks.length) {
      check(
        await supabase
          .from("project_tracks")
          .insert(p.tracks.map((t, i) => ({ user_id: userId, project_id: id, name: t.name, progress: t.progress, sort_order: i }))),
        "update tracks",
      );
    }
    return { id };
  });
}

export async function updateTrackProgress(input: { id: string; progress: number }): Promise<ActionResult> {
  const schema = z.object({ id: z.uuid(), progress: z.coerce.number().min(0).max(100) });
  return mutate(schema, input, async ({ id, progress }, { supabase, userId }) => {
    check(await supabase.from("project_tracks").update({ progress }).eq("id", id).eq("user_id", userId), "update progress");
    return undefined;
  });
}

export async function deleteProject(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("projects").delete().eq("id", id).eq("user_id", userId), "delete the project");
    return undefined;
  });
}

// ---- Goals -------------------------------------------------------------------

export async function saveGoal(input: GoalInput): Promise<ActionResult<{ id: string }>> {
  return mutate(goalSchema, input, async (g, session) => {
    const { supabase, userId } = session;
    const completedOn = g.state === "completed" ? await userToday(session) : null;
    const row = {
      user_id: userId,
      title: g.title,
      description: g.description,
      category_id: g.categoryId,
      horizon: g.horizon,
      measure: g.measure,
      unit: g.unit,
      start_value: g.startValue,
      current_value: g.currentValue,
      target_value: g.targetValue,
      start_date: g.startDate,
      deadline: g.deadline,
      priority: g.priority,
      state: g.state,
      completed_on: completedOn,
    };
    let id = g.id;
    if (id) {
      // Keep the original completion date when re-saving a completed goal.
      const existing = await supabase.from("goals").select("completed_on").eq("id", id).eq("user_id", userId).maybeSingle();
      const kept = g.state === "completed" ? (existing.data?.completed_on as string | null) ?? completedOn : null;
      check(
        await supabase.from("goals").update({ ...row, completed_on: kept }).eq("id", id).eq("user_id", userId),
        "update the goal",
      );
    } else {
      const res = check(await supabase.from("goals").insert(row).select("id").single(), "create the goal");
      id = res.data!.id as string;
    }
    await replaceLinks(session, "goal_skills", "goal_id", id, "skill_id", g.skillIds);
    await replaceLinks(session, "goal_projects", "goal_id", id, "project_id", g.projectIds);
    return { id };
  });
}

export async function updateGoalValue(input: { id: string; currentValue: number }): Promise<ActionResult> {
  const schema = z.object({ id: z.uuid(), currentValue: z.coerce.number().min(-1e9).max(1e9) });
  return mutate(schema, input, async ({ id, currentValue }, { supabase, userId }) => {
    check(
      await supabase.from("goals").update({ current_value: currentValue }).eq("id", id).eq("user_id", userId).eq("measure", "manual"),
      "update the goal",
    );
    return undefined;
  });
}

export async function deleteGoal(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("goals").delete().eq("id", id).eq("user_id", userId), "delete the goal");
    return undefined;
  });
}

// ---- Milestones --------------------------------------------------------------

export async function saveMilestone(input: MilestoneInput): Promise<ActionResult<{ id: string }>> {
  return mutate(milestoneSchema, input, async (m, { supabase, userId }) => {
    const row = {
      user_id: userId,
      title: m.title,
      description: m.description,
      goal_id: m.goalId,
      project_id: m.projectId,
      skill_id: m.skillId,
      due_on: m.dueOn,
      achieved_on: m.achievedOn,
      significance: m.significance,
    };
    if (m.id) {
      check(await supabase.from("milestones").update(row).eq("id", m.id).eq("user_id", userId), "update the milestone");
      return { id: m.id };
    }
    const res = check(await supabase.from("milestones").insert(row).select("id").single(), "create the milestone");
    return { id: res.data!.id as string };
  });
}

export async function toggleMilestone(input: { id: string; achieved: boolean }): Promise<ActionResult> {
  const schema = z.object({ id: z.uuid(), achieved: z.boolean() });
  return mutate(schema, input, async ({ id, achieved }, session) => {
    const achievedOn = achieved ? await userToday(session) : null;
    check(
      await session.supabase.from("milestones").update({ achieved_on: achievedOn }).eq("id", id).eq("user_id", session.userId),
      "update the milestone",
    );
    return undefined;
  });
}

export async function deleteMilestone(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("milestones").delete().eq("id", id).eq("user_id", userId), "delete the milestone");
    return undefined;
  });
}

// ---- Evidence ----------------------------------------------------------------

export async function saveEvidence(input: EvidenceInput): Promise<ActionResult<{ id: string }>> {
  return mutate(evidenceSchema, input, async (e, session) => {
    const { supabase, userId } = session;
    const row = {
      user_id: userId,
      title: e.title,
      kind: e.kind,
      url: e.url,
      description: e.description,
      assessment_score: e.kind === "assessment" ? e.assessmentScore : null,
      occurred_on: e.occurredOn,
      project_id: e.projectId,
      activity_id: e.activityId,
      milestone_id: e.milestoneId,
    };
    let id = e.id;
    if (id) {
      check(await supabase.from("evidence").update(row).eq("id", id).eq("user_id", userId), "update the evidence");
    } else {
      const res = check(await supabase.from("evidence").insert(row).select("id").single(), "save the evidence");
      id = res.data!.id as string;
    }
    await replaceLinks(session, "evidence_skills", "evidence_id", id, "skill_id", e.skillIds);
    return { id };
  });
}

export async function deleteEvidence(input: { id: string }): Promise<ActionResult> {
  return mutate(idOnly, input, async ({ id }, { supabase, userId }) => {
    check(await supabase.from("evidence").delete().eq("id", id).eq("user_id", userId), "delete the evidence");
    return undefined;
  });
}

// ---- Profile & insights ------------------------------------------------------

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  return mutate(profileSchema, input, async (p, { supabase, userId }) => {
    check(
      await supabase
        .from("profiles")
        .update({ display_name: p.displayName, timezone: p.timezone, weekly_hours_goal: p.weeklyHoursGoal })
        .eq("id", userId),
      "save settings",
    );
    return undefined;
  });
}

export async function setInsightState(input: { key: string; state: "dismissed" | "pinned" | null }): Promise<ActionResult> {
  const schema = z.object({ key: z.string().min(1).max(200), state: z.enum(["dismissed", "pinned"]).nullable() });
  return mutate(schema, input, async ({ key, state }, { supabase, userId }) => {
    if (state === null) {
      check(await supabase.from("insights").delete().eq("user_id", userId).eq("insight_key", key), "update the insight");
    } else {
      check(
        await supabase.from("insights").upsert({ user_id: userId, insight_key: key, state }, { onConflict: "user_id,insight_key" }),
        "update the insight",
      );
    }
    return undefined;
  });
}
