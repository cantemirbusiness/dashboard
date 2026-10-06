// Writes the demo workspace to the database for one user (all rows is_demo = true).
// Runs with the user's own client, so RLS applies to every insert.

import type { SupabaseClient } from "@supabase/supabase-js";
import { check } from "@/lib/actions/db-errors";
import { generateDemoData } from "./generate";

async function insertChunked(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    check(await supabase.from(table).insert(rows.slice(i, i + 500)), `load demo ${table}`);
  }
}

export async function seedDemoData(supabase: SupabaseClient, userId: string, today: string, newId?: () => string) {
  const d = generateDemoData(today, newId);
  const u = { user_id: userId, is_demo: true };
  const link = { user_id: userId };

  await insertChunked(supabase, "skill_categories", d.categories.map((c) => ({ ...u, id: c.id, name: c.name, color: c.color, sort_order: c.sortOrder })));
  await insertChunked(
    supabase,
    "skills",
    d.skills.map((s) => ({
      ...u,
      id: s.id,
      category_id: s.categoryId,
      name: s.name,
      description: s.description,
      baseline_score: s.baselineScore,
      target_score: s.targetScore,
      tracked_since: s.trackedSince,
    })),
  );
  await insertChunked(
    supabase,
    "projects",
    d.projects.map((p) => ({
      ...u,
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      manual_progress: p.manualProgress,
      start_date: p.startDate,
      target_date: p.targetDate,
      completed_on: p.completedOn,
      output: p.output,
      notes: p.notes,
      links: p.links,
    })),
  );
  await insertChunked(
    supabase,
    "project_tracks",
    d.projects.flatMap((p) => p.tracks.map((t) => ({ ...u, id: t.id, project_id: p.id, name: t.name, progress: t.progress, sort_order: t.sortOrder }))),
  );
  await insertChunked(supabase, "project_skills", d.projects.flatMap((p) => p.skillIds.map((s) => ({ ...link, project_id: p.id, skill_id: s }))));
  await insertChunked(
    supabase,
    "goals",
    d.goals.map((g) => ({
      ...u,
      id: g.id,
      category_id: g.categoryId,
      title: g.title,
      description: g.description,
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
    })),
  );
  await insertChunked(supabase, "goal_skills", d.goals.flatMap((g) => g.skillIds.map((s) => ({ ...link, goal_id: g.id, skill_id: s }))));
  await insertChunked(supabase, "goal_projects", d.goals.flatMap((g) => g.projectIds.map((p) => ({ ...link, goal_id: g.id, project_id: p }))));
  await insertChunked(
    supabase,
    "milestones",
    d.milestones.map((m) => ({
      ...u,
      id: m.id,
      title: m.title,
      description: m.description,
      goal_id: m.goalId,
      project_id: m.projectId,
      skill_id: m.skillId,
      due_on: m.dueOn,
      achieved_on: m.achievedOn,
      significance: m.significance,
    })),
  );
  await insertChunked(
    supabase,
    "activities",
    d.activities.map((a) => ({
      ...u,
      id: a.id,
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
    })),
  );
  await insertChunked(supabase, "activity_skills", d.activities.flatMap((a) => a.skillIds.map((s) => ({ ...link, activity_id: a.id, skill_id: s }))));
  await insertChunked(
    supabase,
    "evidence",
    d.evidence.map((e) => ({
      ...u,
      id: e.id,
      title: e.title,
      kind: e.kind,
      url: e.url,
      description: e.description,
      assessment_score: e.assessmentScore,
      occurred_on: e.occurredOn,
      activity_id: e.activityId,
      project_id: e.projectId,
      milestone_id: e.milestoneId,
    })),
  );
  await insertChunked(supabase, "evidence_skills", d.evidence.flatMap((e) => e.skillIds.map((s) => ({ ...link, evidence_id: e.id, skill_id: s }))));
  return d;
}

/** Delete every demo row for the user. Join rows cascade; real rows are untouched. */
export async function clearDemoRows(supabase: SupabaseClient, userId: string) {
  for (const table of ["evidence", "activities", "milestones", "goals", "projects", "skills", "skill_categories"]) {
    check(await supabase.from(table).delete().eq("user_id", userId).eq("is_demo", true), `clear demo ${table}`);
  }
  // Snapshots were computed with demo data mixed in; drop them.
  check(await supabase.from("progress_snapshots").delete().eq("user_id", userId), "clear snapshots");
}
