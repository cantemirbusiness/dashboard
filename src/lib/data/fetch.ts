// Loads one user's records from Supabase and maps rows to domain objects.
// Kept free of Next.js imports so it can be exercised by integration tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  Evidence,
  Goal,
  InsightState,
  Milestone,
  Profile,
  Project,
  ProjectTrack,
  Skill,
  SkillCategory,
  Snapshot,
  Workspace,
} from "@/lib/domain";
import { todayIn } from "@/lib/dates";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are mapped field-by-field below */
type Row = Record<string, any>;

/** PostgREST caps responses (1000 rows by default) — page through everything. */
async function fetchAll(supabase: SupabaseClient, table: string, userId: string, order?: string): Promise<Row[]> {
  const pageSize = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select("*").eq("user_id", userId);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

function groupIds(rows: Row[], key: string, value: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const list = m.get(r[key]);
    if (list) list.push(r[value]);
    else m.set(r[key], [r[value]]);
  }
  return m;
}

const num = (v: unknown, fallback = 0) => (v == null ? fallback : Number(v));

/** Load every record the Progress Engine needs for one user. Not cached. */
export async function fetchWorkspace(supabase: SupabaseClient, userId: string): Promise<Workspace> {
  const [
    profileRes,
    categories,
    skills,
    projects,
    tracks,
    projectSkills,
    goals,
    goalSkills,
    goalProjects,
    milestones,
    activities,
    activitySkills,
    evidence,
    evidenceSkills,
    snapshots,
    insights,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    fetchAll(supabase, "skill_categories", userId, "sort_order"),
    fetchAll(supabase, "skills", userId, "created_at"),
    fetchAll(supabase, "projects", userId, "created_at"),
    fetchAll(supabase, "project_tracks", userId, "sort_order"),
    fetchAll(supabase, "project_skills", userId),
    fetchAll(supabase, "goals", userId, "created_at"),
    fetchAll(supabase, "goal_skills", userId),
    fetchAll(supabase, "goal_projects", userId),
    fetchAll(supabase, "milestones", userId, "created_at"),
    fetchAll(supabase, "activities", userId, "occurred_on"),
    fetchAll(supabase, "activity_skills", userId),
    fetchAll(supabase, "evidence", userId, "occurred_on"),
    fetchAll(supabase, "evidence_skills", userId),
    fetchAll(supabase, "progress_snapshots", userId, "snapshot_on"),
    fetchAll(supabase, "insights", userId),
  ]);
  if (profileRes.error) throw new Error(`Failed to load profile: ${profileRes.error.message}`);
  const p = profileRes.data as Row | null;

  const profile: Profile = {
    id: userId,
    displayName: p?.display_name ?? null,
    timezone: p?.timezone ?? "UTC",
    weeklyHoursGoal: num(p?.weekly_hours_goal, 10),
    onboardedAt: p?.onboarded_at ?? null,
  };

  const projSkills = groupIds(projectSkills, "project_id", "skill_id");
  const tracksByProject = new Map<string, ProjectTrack[]>();
  for (const t of tracks) {
    const track: ProjectTrack = {
      id: t.id,
      projectId: t.project_id,
      name: t.name,
      progress: num(t.progress),
      sortOrder: t.sort_order,
    };
    tracksByProject.set(t.project_id, [...(tracksByProject.get(t.project_id) ?? []), track]);
  }
  const gSkills = groupIds(goalSkills, "goal_id", "skill_id");
  const gProjects = groupIds(goalProjects, "goal_id", "project_id");
  const aSkills = groupIds(activitySkills, "activity_id", "skill_id");
  const eSkills = groupIds(evidenceSkills, "evidence_id", "skill_id");

  return {
    profile,
    today: todayIn(profile.timezone),
    categories: categories.map(
      (r): SkillCategory => ({ id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order, isDemo: r.is_demo }),
    ),
    skills: skills.map(
      (r): Skill => ({
        id: r.id,
        categoryId: r.category_id,
        name: r.name,
        description: r.description,
        baselineScore: num(r.baseline_score),
        targetScore: num(r.target_score),
        trackedSince: r.tracked_since,
        archived: r.archived,
        isDemo: r.is_demo,
      }),
    ),
    projects: projects.map(
      (r): Project => ({
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status,
        manualProgress: num(r.manual_progress),
        startDate: r.start_date,
        targetDate: r.target_date,
        completedOn: r.completed_on,
        output: r.output,
        notes: r.notes,
        links: r.links ?? [],
        skillIds: projSkills.get(r.id) ?? [],
        tracks: tracksByProject.get(r.id) ?? [],
        isDemo: r.is_demo,
      }),
    ),
    goals: goals.map(
      (r): Goal => ({
        id: r.id,
        categoryId: r.category_id,
        title: r.title,
        description: r.description,
        horizon: r.horizon,
        measure: r.measure,
        unit: r.unit,
        startValue: num(r.start_value),
        currentValue: num(r.current_value),
        targetValue: num(r.target_value),
        startDate: r.start_date,
        deadline: r.deadline,
        priority: r.priority,
        state: r.state,
        completedOn: r.completed_on,
        skillIds: gSkills.get(r.id) ?? [],
        projectIds: gProjects.get(r.id) ?? [],
        isDemo: r.is_demo,
      }),
    ),
    milestones: milestones.map(
      (r): Milestone => ({
        id: r.id,
        title: r.title,
        description: r.description,
        goalId: r.goal_id,
        projectId: r.project_id,
        skillId: r.skill_id,
        dueOn: r.due_on,
        achievedOn: r.achieved_on,
        significance: r.significance,
        isDemo: r.is_demo,
      }),
    ),
    activities: activities.map(
      (r): Activity => ({
        id: r.id,
        occurredOn: r.occurred_on,
        title: r.title,
        description: r.description,
        type: r.type,
        mode: r.mode,
        projectId: r.project_id,
        durationMinutes: r.duration_minutes,
        difficulty: r.difficulty,
        outcome: r.outcome,
        notes: r.notes,
        skillIds: aSkills.get(r.id) ?? [],
        isDemo: r.is_demo,
        createdAt: r.created_at,
      }),
    ),
    evidence: evidence.map(
      (r): Evidence => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        url: r.url,
        description: r.description,
        assessmentScore: r.assessment_score == null ? null : num(r.assessment_score),
        occurredOn: r.occurred_on,
        activityId: r.activity_id,
        projectId: r.project_id,
        milestoneId: r.milestone_id,
        skillIds: eSkills.get(r.id) ?? [],
        isDemo: r.is_demo,
      }),
    ),
    snapshots: snapshots.map(
      (r): Snapshot => ({ snapshotOn: r.snapshot_on, key: r.key, score: num(r.score), engineVersion: r.engine_version }),
    ),
    insightStates: insights.map((r): InsightState => ({ key: r.insight_key, state: r.state })),
  };
}

