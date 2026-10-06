// Workspace analysis: turns raw records into everything the UI shows.
// Pure and deterministic — the same data always produces the same output.

import type { Evidence, Goal, Milestone, Project, Skill, SkillCategory, Workspace } from "@/lib/domain";
import { addDays, daysBetween, maxIso, minIso } from "@/lib/dates";
import {
  COMPONENTS,
  GOAL_RELEVANCE_BONUS,
  GOAL_RELEVANCE_MAX_GOALS,
  MIN_HISTORY_DAYS,
  STATUS,
  type Component,
} from "./config";
import { computeConsistency, type ConsistencyResult } from "./consistency";
import { buildSkillInputs, hoursByMode, scoreSkill, type SkillInputs, type SkillScore } from "./skills";

// ---- Types -------------------------------------------------------------------

export type SkillStatus = "improving" | "stable" | "stagnating" | "declining" | "needs_attention";

export interface SkillAnalysis {
  skill: Skill;
  category: SkillCategory | null;
  current: SkillScore;
  score: number;
  delta7: number;
  delta30: number;
  delta90: number;
  status: SkillStatus;
  /** Plain-language reasons for the status. */
  statusReasons: string[];
  lastActivityOn: string | null;
  daysSinceActivity: number | null;
  hours90: { knowledge: number; practice: number; execution: number; total: number };
  hoursAll: { knowledge: number; practice: number; execution: number; total: number };
  evidence: Evidence[];
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  theoryHeavy: boolean;
  goalIds: string[];
  projectIds: string[];
  /** Weight in the overall score (goal relevance). */
  weight: number;
  /** Weekly scores for the last 12 weeks, oldest first. */
  sparkline: number[];
}

export type GoalStatus = "on_track" | "at_risk" | "behind" | "completed" | "abandoned";

export interface GoalAnalysis {
  goal: Goal;
  start: number;
  current: number;
  target: number;
  /** 0–1 share of the distance from start to target that is covered. */
  progress: number;
  /** 0–1 share of the time between start and deadline that has elapsed. */
  timeElapsed: number | null;
  status: GoalStatus;
  statusReason: string;
  /** Change in `current` per 30 days, measured over the last 30–60 days. */
  velocity30: number | null;
  projectedAtDeadline: number | null;
  daysLeft: number | null;
  milestones: Milestone[];
  /** Points for a trajectory chart. `null` when not reconstructable (manual goals). */
  trajectory: { date: string; value: number }[] | null;
}

export interface ProjectAnalysis {
  project: Project;
  progress: number;
  hours: number;
  hours30: number;
  activityCount: number;
  lastActivityOn: string | null;
  milestones: Milestone[];
  evidence: Evidence[];
  overdue: boolean;
  daysToTarget: number | null;
}

export type Dimensions = Record<Component, number>;

export interface Analysis {
  today: string;
  skills: SkillAnalysis[];
  skillById: Map<string, SkillAnalysis>;
  categories: SkillCategory[];
  overall: {
    score: number | null;
    previous: number | null; // 30 days ago
    change: number | null;
    series: { date: string; value: number }[]; // weekly, last 26 weeks with data
    explanation: string;
  };
  dimensions: { current: Dimensions; previous: Dimensions };
  consistency: ConsistencyResult;
  goals: GoalAnalysis[];
  projects: ProjectAnalysis[];
  history: { earliest: string | null; days: number; sufficient: boolean };
  /** Score any skill at any date (records after that date are ignored). */
  skillAt: (skillId: string, date: string) => number | null;
  overallAt: (date: string) => number | null;
  dimensionsAt: (date: string) => Dimensions | null;
}

// ---- Helpers -----------------------------------------------------------------

const EMPTY_DIMS = (): Dimensions => ({ knowledge: 0, practice: 0, execution: 0, demonstrated: 0, output: 0 });

function weightedMean(pairs: { value: number; weight: number }[]): number | null {
  let sum = 0;
  let w = 0;
  for (const p of pairs) {
    sum += p.value * p.weight;
    w += p.weight;
  }
  return w > 0 ? sum / w : null;
}

function pickConfidence(score: SkillScore, evidenceCount: number) {
  const evidenceGain = score.components.demonstrated.contribution + score.components.output.contribution;
  const share = score.earned > 0 ? evidenceGain / score.earned : 0;
  if (evidenceCount >= 2 && share >= 0.25) {
    return {
      confidence: "high" as const,
      reason: `${Math.round(share * 100)}% of the earned score is backed by evidence or real output.`,
    };
  }
  if (evidenceCount >= 1 || share > 0) {
    return {
      confidence: "medium" as const,
      reason: "Some evidence supports this score; most of it comes from logged activity.",
    };
  }
  return {
    confidence: "low" as const,
    reason: "No evidence yet — this score is based on your baseline and logged activity only.",
  };
}

// ---- Main --------------------------------------------------------------------

export function analyzeWorkspace(ws: Workspace): Analysis {
  const today = ws.today;
  const activeSkills = ws.skills.filter((s) => !s.archived);
  const inputs = buildSkillInputs({ ...ws, skills: activeSkills });
  const categoryById = new Map(ws.categories.map((c) => [c.id, c]));

  // Goal relevance: active goals linking each skill.
  const activeGoals = ws.goals.filter((g) => g.state === "active");
  const goalsBySkill = new Map<string, string[]>();
  for (const g of ws.goals) {
    for (const sid of g.skillIds) goalsBySkill.set(sid, [...(goalsBySkill.get(sid) ?? []), g.id]);
  }
  const activeGoalCount = (skillId: string) => activeGoals.filter((g) => g.skillIds.includes(skillId)).length;
  const weightOf = (skillId: string) =>
    1 + GOAL_RELEVANCE_BONUS * Math.min(GOAL_RELEVANCE_MAX_GOALS, activeGoalCount(skillId));

  const projectsBySkill = new Map<string, string[]>();
  for (const p of ws.projects) {
    for (const sid of p.skillIds) projectsBySkill.set(sid, [...(projectsBySkill.get(sid) ?? []), p.id]);
  }

  // Evidence per skill (direct links, or inherited via activity/project).
  const activityById = new Map(ws.activities.map((a) => [a.id, a]));
  const projectById = new Map(ws.projects.map((p) => [p.id, p]));
  const evidenceBySkill = new Map<string, Evidence[]>();
  for (const e of ws.evidence) {
    let skills = e.skillIds;
    if (skills.length === 0 && e.activityId) skills = activityById.get(e.activityId)?.skillIds ?? [];
    if (skills.length === 0 && e.projectId) skills = projectById.get(e.projectId)?.skillIds ?? [];
    for (const sid of skills) evidenceBySkill.set(sid, [...(evidenceBySkill.get(sid) ?? []), e]);
  }

  // Memoised scorer — history charts call this many times.
  const cache = new Map<string, SkillScore>();
  const scoreAtRaw = (inp: SkillInputs, date: string): SkillScore => {
    const key = `${inp.skill.id}|${date}`;
    let s = cache.get(key);
    if (!s) {
      s = scoreSkill(inp, date, false);
      cache.set(key, s);
    }
    return s;
  };
  const isTracked = (inp: SkillInputs, date: string) =>
    inp.skill.trackedSince <= date || (inp.items[0] && inp.items[0].date <= date);

  const skillAt = (skillId: string, date: string): number | null => {
    const inp = inputs.get(skillId);
    if (!inp || !isTracked(inp, date)) return null;
    return scoreAtRaw(inp, date).score;
  };

  const overallAt = (date: string): number | null =>
    weightedMean(
      [...inputs.values()]
        .filter((inp) => isTracked(inp, date))
        .map((inp) => ({ value: scoreAtRaw(inp, date).score, weight: weightOf(inp.skill.id) })),
    );

  const dimensionsAt = (date: string): Dimensions | null => {
    const tracked = [...inputs.values()].filter((inp) => isTracked(inp, date));
    if (tracked.length === 0) return null;
    const out = EMPTY_DIMS();
    for (const c of COMPONENTS) {
      out[c] =
        100 *
        (weightedMean(
          tracked.map((inp) => ({
            value: scoreAtRaw(inp, date).components[c].saturation,
            weight: weightOf(inp.skill.id),
          })),
        ) ?? 0);
    }
    return out;
  };

  // ---- Skills ----
  const skills: SkillAnalysis[] = [];
  for (const inp of inputs.values()) {
    const { skill } = inp;
    const current = scoreSkill(inp, today, true);
    const at = (days: number) => skillAt(skill.id, addDays(today, -days)) ?? skill.baselineScore;
    const delta7 = current.score - at(7);
    const delta30 = current.score - at(30);
    const delta90 = current.score - at(90);
    const lastActivityOn = inp.activityDates.length ? inp.activityDates.filter((d) => d <= today).at(-1) ?? null : null;
    const daysSinceActivity = lastActivityOn ? daysBetween(lastActivityOn, today) : null;
    const hours90 = hoursByMode(inp, addDays(today, -90), today);
    const hoursAll = hoursByMode(inp, null, today);
    const evidence = (evidenceBySkill.get(skill.id) ?? []).filter((e) => e.occurredOn <= today);
    const { confidence, reason: confidenceReason } = pickConfidence(current, evidence.length);
    const goalIds = goalsBySkill.get(skill.id) ?? [];
    const goalLinked = activeGoalCount(skill.id) > 0;

    const k = current.components.knowledge.saturation;
    const handsOn = (current.components.execution.saturation + current.components.output.saturation) / 2;
    const theoryHeavy = k >= STATUS.theoryKnowledgeMin && handsOn < k * STATUS.theoryHandsOnRatio;

    // Status — evaluated in this order; "needs attention" overrides the rest.
    const reasons: string[] = [];
    let status: SkillStatus;
    if (delta30 <= STATUS.decliningDelta30) {
      status = "declining";
      reasons.push(`Down ${Math.abs(delta30).toFixed(1)} over 30 days as recent activity fades.`);
    } else if (delta30 >= STATUS.improvingDelta30) {
      status = "improving";
      reasons.push(`Up ${delta30.toFixed(1)} over 30 days.`);
    } else if (daysSinceActivity == null || daysSinceActivity > STATUS.stagnantAfterDays) {
      status = "stagnating";
      reasons.push(
        daysSinceActivity == null
          ? "No activity logged for this skill yet."
          : `No activity in ${daysSinceActivity} days.`,
      );
    } else {
      status = "stable";
      reasons.push(`Changed ${delta30 >= 0 ? "+" : ""}${delta30.toFixed(1)} over 30 days.`);
    }

    const attention: string[] = [];
    if (goalLinked && (status === "stagnating" || status === "declining")) {
      attention.push("It supports an active goal but is not moving.");
    }
    if (
      current.score < STATUS.lowScore &&
      skill.targetScore - current.score >= STATUS.largeGap &&
      (daysSinceActivity == null || daysSinceActivity > 14)
    ) {
      attention.push(`Low score (${current.score.toFixed(0)}) far from target (${skill.targetScore}) with little recent work.`);
    }
    if (theoryHeavy && goalLinked) {
      attention.push(
        `Mostly theory: ${hoursAll.knowledge.toFixed(0)}h studying vs ${(hoursAll.execution + hoursAll.practice).toFixed(0)}h hands-on.`,
      );
    }
    if (attention.length) {
      status = "needs_attention";
      reasons.unshift(...attention);
    }

    // Sparkline: weekly for 12 weeks.
    const sparkline: number[] = [];
    for (let i = 12; i >= 0; i--) sparkline.push(at(i * 7));

    skills.push({
      skill,
      category: skill.categoryId ? categoryById.get(skill.categoryId) ?? null : null,
      current,
      score: current.score,
      delta7,
      delta30,
      delta90,
      status,
      statusReasons: reasons,
      lastActivityOn,
      daysSinceActivity,
      hours90,
      hoursAll,
      evidence,
      confidence,
      confidenceReason,
      theoryHeavy,
      goalIds,
      projectIds: projectsBySkill.get(skill.id) ?? [],
      weight: weightOf(skill.id),
      sparkline,
    });
  }

  // Order: category sort order, then score.
  const catOrder = (s: SkillAnalysis) => s.category?.sortOrder ?? 999;
  skills.sort((a, b) => catOrder(a) - catOrder(b) || b.score - a.score);
  const skillById = new Map(skills.map((s) => [s.skill.id, s]));

  // ---- History extent ----
  const dates: string[] = [];
  for (const s of activeSkills) dates.push(s.trackedSince);
  for (const a of ws.activities) dates.push(a.occurredOn);
  for (const e of ws.evidence) dates.push(e.occurredOn);
  const earliest = dates.length ? dates.reduce(minIso) : null;
  const historyDays = earliest ? Math.max(0, daysBetween(earliest, today)) : 0;

  // ---- Overall ----
  const score = overallAt(today);
  const prevDate = addDays(today, -30);
  const previous = earliest && earliest <= prevDate ? overallAt(prevDate) : null;
  const series: { date: string; value: number }[] = [];
  if (earliest) {
    const start = maxIso(earliest, addDays(today, -7 * 26));
    for (let d = today; d >= start; d = addDays(d, -7)) {
      const v = overallAt(d);
      if (v != null) series.unshift({ date: d, value: v });
    }
  }
  const linked = skills.filter((s) => s.weight > 1).length;
  const explanation =
    score == null
      ? "Add skills and log activity to get an overall score."
      : `Weighted average of ${skills.length} active skill${skills.length === 1 ? "" : "s"}` +
        (linked ? `; ${linked} tied to active goals count up to 2× as much.` : ".");

  // ---- Dimensions ----
  const dims = dimensionsAt(today) ?? EMPTY_DIMS();
  const prevDims = dimensionsAt(prevDate) ?? EMPTY_DIMS();

  // ---- Goals ----
  const milestonesByGoal = new Map<string, Milestone[]>();
  for (const m of ws.milestones) {
    if (m.goalId) milestonesByGoal.set(m.goalId, [...(milestonesByGoal.get(m.goalId) ?? []), m]);
  }
  const goals = ws.goals.map((g) => analyzeGoal(g, milestonesByGoal.get(g.id) ?? [], today, skillAt));
  const statusRank: Record<GoalStatus, number> = { behind: 0, at_risk: 1, on_track: 2, completed: 3, abandoned: 4 };
  const prioRank = { high: 0, medium: 1, low: 2 };
  goals.sort((a, b) => statusRank[a.status] - statusRank[b.status] || prioRank[a.goal.priority] - prioRank[b.goal.priority]);

  // ---- Projects ----
  const projects = ws.projects.map((p) => analyzeProject(p, ws, today));
  const projRank = { active: 0, planning: 1, paused: 2, completed: 3, abandoned: 4 };
  projects.sort((a, b) => projRank[a.project.status] - projRank[b.project.status] || b.progress - a.progress);

  return {
    today,
    skills,
    skillById,
    categories: [...ws.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    overall: {
      score,
      previous,
      change: score != null && previous != null ? score - previous : null,
      series,
      explanation,
    },
    dimensions: { current: dims, previous: prevDims },
    consistency: computeConsistency(ws.activities, today),
    goals,
    projects,
    history: { earliest, days: historyDays, sufficient: historyDays >= MIN_HISTORY_DAYS },
    skillAt,
    overallAt,
    dimensionsAt,
  };
}

// ---- Goals -------------------------------------------------------------------

export function analyzeGoal(
  goal: Goal,
  milestones: Milestone[],
  today: string,
  skillAt: (skillId: string, date: string) => number | null,
): GoalAnalysis {
  const target = goal.targetValue;

  const valueAt = (date: string): number | null => {
    if (goal.measure === "skills" && goal.skillIds.length) {
      const vals = goal.skillIds.map((id) => skillAt(id, date)).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    if (goal.measure === "milestones" && milestones.length) {
      const done = milestones.filter((m) => m.achievedOn && m.achievedOn <= date).length;
      return (100 * done) / milestones.length;
    }
    return null;
  };

  const reconstructable = (goal.measure === "skills" && goal.skillIds.length > 0) || (goal.measure === "milestones" && milestones.length > 0);
  const current = reconstructable ? valueAt(today) ?? goal.currentValue : goal.currentValue;
  const start = reconstructable ? valueAt(goal.startDate) ?? goal.startValue : goal.startValue;

  const span = target - start;
  const progress = span > 0 ? Math.max(0, Math.min(1, (current - start) / span)) : current >= target ? 1 : 0;

  const elapsed = Math.max(0, daysBetween(goal.startDate, today));
  const total = goal.deadline ? daysBetween(goal.startDate, goal.deadline) : null;
  const timeElapsed = total && total > 0 ? Math.min(1, elapsed / total) : null;
  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;

  // Velocity: change per 30 days.
  let velocity30: number | null = null;
  if (reconstructable) {
    const window = Math.min(60, elapsed);
    if (window >= 14) {
      const past = valueAt(addDays(today, -window));
      if (past != null) velocity30 = ((current - past) / window) * 30;
    }
  } else if (elapsed >= 14) {
    velocity30 = ((current - start) / elapsed) * 30;
  }
  const projectedAtDeadline =
    velocity30 != null && daysLeft != null && daysLeft > 0 ? current + (velocity30 / 30) * daysLeft : null;

  let status: GoalStatus;
  let statusReason: string;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (goal.state === "abandoned") {
    status = "abandoned";
    statusReason = "You marked this goal as abandoned.";
  } else if (goal.state === "completed" || current >= target) {
    status = "completed";
    statusReason = goal.state === "completed" ? "Marked complete." : "Current value has reached the target.";
  } else if (daysLeft != null && daysLeft < 0) {
    status = "behind";
    statusReason = `Deadline passed ${-daysLeft} days ago at ${pct(progress)} complete.`;
  } else if (timeElapsed != null) {
    const ratio = timeElapsed > 0 ? progress / timeElapsed : 1;
    const projectedHit = projectedAtDeadline != null && projectedAtDeadline >= target;
    if (timeElapsed < 0.1 || ratio >= 0.9 || projectedHit) {
      status = "on_track";
      statusReason =
        timeElapsed < 0.1
          ? `Early days: ${pct(timeElapsed)} of the time has passed.`
          : projectedHit && ratio < 0.9
            ? `Behind the straight-line pace, but the last 30 days project to ${projectedAtDeadline!.toFixed(0)} by the deadline.`
            : `${pct(progress)} done with ${pct(timeElapsed)} of the time used.`;
    } else if (ratio >= 0.65 || (projectedAtDeadline != null && projectedAtDeadline >= start + 0.8 * span)) {
      status = "at_risk";
      statusReason = `${pct(progress)} done with ${pct(timeElapsed)} of the time used` +
        (projectedAtDeadline != null ? `; current pace reaches ~${projectedAtDeadline.toFixed(0)} of ${target}.` : ".");
    } else {
      status = "behind";
      statusReason = `${pct(progress)} done with ${pct(timeElapsed)} of the time used` +
        (projectedAtDeadline != null ? `; current pace reaches only ~${projectedAtDeadline.toFixed(0)} of ${target}.` : ".");
    }
  } else {
    // No deadline: judge by momentum.
    if (velocity30 != null && velocity30 > 0) {
      status = "on_track";
      statusReason = `No deadline; moving +${velocity30.toFixed(1)} per 30 days.`;
    } else if (velocity30 == null) {
      status = "on_track";
      statusReason = "No deadline and too little history to judge momentum yet.";
    } else {
      status = "at_risk";
      statusReason = "No deadline and no progress in the last 30 days.";
    }
  }

  let trajectory: { date: string; value: number }[] | null = null;
  if (reconstructable) {
    trajectory = [];
    const step = Math.max(7, Math.ceil(elapsed / 26));
    for (let d = today; d >= goal.startDate; d = addDays(d, -step)) {
      const v = valueAt(d);
      if (v != null) trajectory.unshift({ date: d, value: v });
    }
    if (trajectory.length && trajectory[0].date !== goal.startDate) {
      trajectory.unshift({ date: goal.startDate, value: start });
    }
  }

  return {
    goal,
    start,
    current,
    target,
    progress,
    timeElapsed,
    status,
    statusReason,
    velocity30,
    projectedAtDeadline,
    daysLeft,
    milestones: [...milestones].sort((a, b) => (a.dueOn ?? "9999") < (b.dueOn ?? "9999") ? -1 : 1),
    trajectory,
  };
}

// ---- Projects ----------------------------------------------------------------

export function projectProgress(p: Project): number {
  if (p.status === "completed") return 100;
  if (p.tracks.length === 0) return p.manualProgress;
  return p.tracks.reduce((s, t) => s + t.progress, 0) / p.tracks.length;
}

function analyzeProject(p: Project, ws: Workspace, today: string): ProjectAnalysis {
  const acts = ws.activities.filter((a) => a.projectId === p.id && a.occurredOn <= today);
  const since30 = addDays(today, -30);
  const hours = acts.reduce((s, a) => s + a.durationMinutes, 0) / 60;
  const hours30 = acts.filter((a) => a.occurredOn > since30).reduce((s, a) => s + a.durationMinutes, 0) / 60;
  const lastActivityOn = acts.length ? acts.map((a) => a.occurredOn).reduce(maxIso) : null;
  const open = p.status === "active" || p.status === "planning" || p.status === "paused";
  const daysToTarget = p.targetDate ? daysBetween(today, p.targetDate) : null;
  return {
    project: p,
    progress: projectProgress(p),
    hours,
    hours30,
    activityCount: acts.length,
    lastActivityOn,
    milestones: ws.milestones.filter((m) => m.projectId === p.id),
    evidence: ws.evidence.filter((e) => e.projectId === p.id),
    overdue: open && daysToTarget != null && daysToTarget < 0,
    daysToTarget,
  };
}
