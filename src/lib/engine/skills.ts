// Skill scoring — the heart of the Progress Engine.
//
// A skill's score is rebuilt from dated records (activities, evidence,
// completed projects, achieved milestones), so it can be computed "as of" any
// past date. That is how historical charts are drawn without inventing data:
// each historical point only uses records that existed on that day.

import type { Activity, ActivityMode, Skill, Workspace } from "@/lib/domain";
import { daysBetween } from "@/lib/dates";
import {
  COMPLETED_PROJECT_WEIGHT,
  COMPONENTS,
  COMPONENT_SHARE,
  CONSISTENCY_FLOOR,
  CONSISTENCY_WINDOW_WEEKS,
  DIFFICULTY_WEIGHT,
  EVIDENCE_WEIGHT,
  HOURS_EXPONENT,
  MILESTONE_WEIGHT_PER_SIGNIFICANCE,
  MODE_WEIGHT,
  OUTCOME_WEIGHT,
  RECENCY_FLOOR,
  RECENCY_HALF_LIFE_DAYS,
  SATURATION,
  SESSION_HOURS_CAP,
  type Component,
} from "./config";

export type SourceKind = "activity" | "evidence" | "project" | "milestone";

/** One dated record that feeds one component of one skill. */
export interface ScoreItem {
  source: SourceKind;
  id: string;
  title: string;
  date: string;
  component: Component;
  /** Points before recency decay (already split across linked skills). */
  basePoints: number;
  /** Activities decay with age; evidence, projects and milestones do not. */
  decays: boolean;
  /** Minutes attributed to this skill (activities only). */
  minutes: number;
}

export interface ComponentResult {
  points: number;
  /** 0–1: how "full" this component is. */
  saturation: number;
  /** Score points this component adds on top of the baseline. */
  contribution: number;
}

export interface Contribution {
  source: SourceKind;
  id: string;
  title: string;
  date: string;
  component: Component;
  points: number;
  /** Score points attributable to this item (sums to `earned`). */
  contribution: number;
}

export interface SkillScore {
  skillId: string;
  asOf: string;
  score: number;
  baseline: number;
  earned: number;
  components: Record<Component, ComponentResult>;
  consistency: { activeWeeks: number; windowWeeks: number; multiplier: number };
  contributions: Contribution[];
}

// ---- Activity points ---------------------------------------------------------

export function hoursFactor(minutes: number): number {
  const hours = Math.min(minutes / 60, SESSION_HOURS_CAP);
  return Math.pow(hours, HOURS_EXPONENT);
}

/** Points an activity earns in total, before recency and before splitting across skills. */
export function activityPoints(a: Pick<Activity, "durationMinutes" | "mode" | "difficulty" | "outcome">): number {
  return (
    hoursFactor(a.durationMinutes) *
    MODE_WEIGHT[a.mode] *
    (DIFFICULTY_WEIGHT[a.difficulty] ?? 1) *
    OUTCOME_WEIGHT[a.outcome]
  );
}

export function recencyWeight(itemDate: string, asOf: string): number {
  const age = Math.max(0, daysBetween(itemDate, asOf));
  return RECENCY_FLOOR + (1 - RECENCY_FLOOR) * Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS);
}

function modeComponent(mode: ActivityMode): Component {
  return mode;
}

// ---- Building per-skill inputs -----------------------------------------------

export interface SkillInputs {
  skill: Skill;
  items: ScoreItem[];
  /** Dates of activities that touched this skill (for consistency/recency). */
  activityDates: string[];
}

/**
 * Turn the workspace into a list of dated, weighted items per skill.
 * Rules for linking (documented in docs/PROGRESS_ENGINE.md):
 *  - An activity's time is split evenly across its skills (an hour is an hour).
 *  - Evidence / projects / milestones are divided by √n across n skills: one
 *    artifact genuinely demonstrates several skills, but not fully each.
 *  - Evidence without skills inherits them from its activity, then its project.
 *  - A milestone already backed by an evidence record is not counted twice.
 */
export function buildSkillInputs(ws: Pick<Workspace, "skills" | "activities" | "evidence" | "projects" | "milestones">): Map<string, SkillInputs> {
  const map = new Map<string, SkillInputs>();
  for (const skill of ws.skills) map.set(skill.id, { skill, items: [], activityDates: [] });

  const push = (skillId: string, item: ScoreItem) => {
    const entry = map.get(skillId);
    if (entry) entry.items.push(item);
  };

  const activityById = new Map(ws.activities.map((a) => [a.id, a]));
  const projectById = new Map(ws.projects.map((p) => [p.id, p]));

  for (const a of ws.activities) {
    const skills = a.skillIds.filter((id) => map.has(id));
    if (skills.length === 0) continue;
    const pts = activityPoints(a) / skills.length;
    for (const skillId of skills) {
      push(skillId, {
        source: "activity",
        id: a.id,
        title: a.title,
        date: a.occurredOn,
        component: modeComponent(a.mode),
        basePoints: pts,
        decays: true,
        minutes: a.durationMinutes / skills.length,
      });
      map.get(skillId)!.activityDates.push(a.occurredOn);
    }
  }

  const milestonesWithEvidence = new Set<string>();
  for (const e of ws.evidence) {
    if (e.milestoneId) milestonesWithEvidence.add(e.milestoneId);
    let skills = e.skillIds;
    if (skills.length === 0 && e.activityId) skills = activityById.get(e.activityId)?.skillIds ?? [];
    if (skills.length === 0 && e.projectId) skills = projectById.get(e.projectId)?.skillIds ?? [];
    skills = skills.filter((id) => map.has(id));
    if (skills.length === 0) continue;
    const def = EVIDENCE_WEIGHT[e.kind];
    let weight = def.weight;
    if (e.kind === "assessment" && e.assessmentScore != null) weight *= e.assessmentScore / 100;
    const pts = weight / Math.sqrt(skills.length);
    for (const skillId of skills) {
      push(skillId, {
        source: "evidence",
        id: e.id,
        title: e.title,
        date: e.occurredOn,
        component: def.channel,
        basePoints: pts,
        decays: false,
        minutes: 0,
      });
    }
  }

  for (const p of ws.projects) {
    if (p.status !== "completed" || !p.completedOn) continue;
    const skills = p.skillIds.filter((id) => map.has(id));
    if (skills.length === 0) continue;
    const pts = COMPLETED_PROJECT_WEIGHT / Math.sqrt(skills.length);
    for (const skillId of skills) {
      push(skillId, {
        source: "project",
        id: p.id,
        title: `Completed project: ${p.name}`,
        date: p.completedOn,
        component: "output",
        basePoints: pts,
        decays: false,
        minutes: 0,
      });
    }
  }

  for (const m of ws.milestones) {
    if (!m.achievedOn || milestonesWithEvidence.has(m.id)) continue;
    let skills: string[] = m.skillId ? [m.skillId] : [];
    if (skills.length === 0 && m.projectId) skills = projectById.get(m.projectId)?.skillIds ?? [];
    skills = skills.filter((id) => map.has(id));
    if (skills.length === 0) continue;
    const pts = (m.significance * MILESTONE_WEIGHT_PER_SIGNIFICANCE) / Math.sqrt(skills.length);
    for (const skillId of skills) {
      push(skillId, {
        source: "milestone",
        id: m.id,
        title: `Milestone: ${m.title}`,
        date: m.achievedOn,
        component: "demonstrated",
        basePoints: pts,
        decays: false,
        minutes: 0,
      });
    }
  }

  for (const entry of map.values()) {
    entry.items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    entry.activityDates.sort();
  }
  return map;
}

// ---- Scoring -----------------------------------------------------------------

export function saturation(points: number, component: Component): number {
  return 1 - Math.exp(-points / SATURATION[component]);
}

function consistencyAt(inputs: SkillInputs, asOf: string) {
  const trackedDays = Math.max(1, daysBetween(inputs.skill.trackedSince, asOf) + 1);
  const windowWeeks = Math.max(1, Math.min(CONSISTENCY_WINDOW_WEEKS, Math.ceil(trackedDays / 7)));
  const weeks = new Set<number>();
  for (const d of inputs.activityDates) {
    if (d > asOf) break;
    const ago = daysBetween(d, asOf);
    const bucket = Math.floor(ago / 7);
    if (bucket < windowWeeks) weeks.add(bucket);
  }
  const activeWeeks = weeks.size;
  const multiplier = CONSISTENCY_FLOOR + (1 - CONSISTENCY_FLOOR) * Math.min(1, activeWeeks / windowWeeks);
  return { activeWeeks, windowWeeks, multiplier };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Score a skill using only records dated on or before `asOf`. */
export function scoreSkill(inputs: SkillInputs, asOf: string, withContributions = true): SkillScore {
  const { skill } = inputs;
  const baseline = skill.baselineScore;
  const headroom = 100 - baseline;

  const points: Record<Component, number> = { knowledge: 0, practice: 0, execution: 0, demonstrated: 0, output: 0 };
  const weighted: { item: ScoreItem; points: number }[] = [];
  for (const item of inputs.items) {
    if (item.date > asOf) break;
    const p = item.decays ? item.basePoints * recencyWeight(item.date, asOf) : item.basePoints;
    points[item.component] += p;
    if (withContributions) weighted.push({ item, points: p });
  }

  const consistency = consistencyAt(inputs, asOf);
  const components = {} as Record<Component, ComponentResult>;
  let earned = 0;
  for (const c of COMPONENTS) {
    const sat = saturation(points[c], c);
    const contribution = headroom * COMPONENT_SHARE[c] * sat * consistency.multiplier;
    components[c] = { points: round2(points[c]), saturation: sat, contribution };
    earned += contribution;
  }

  let contributions: Contribution[] = [];
  if (withContributions) {
    contributions = weighted
      .map(({ item, points: p }) => {
        const total = points[item.component];
        const share = total > 0 ? p / total : 0;
        return {
          source: item.source,
          id: item.id,
          title: item.title,
          date: item.date,
          component: item.component,
          points: round2(p),
          contribution: components[item.component].contribution * share,
        };
      })
      .sort((a, b) => b.contribution - a.contribution);
  }

  return {
    skillId: skill.id,
    asOf,
    score: Math.min(100, baseline + earned),
    baseline,
    earned,
    components,
    consistency,
    contributions,
  };
}

/** Hours spent on a skill by mode within (from, to]. */
export function hoursByMode(inputs: SkillInputs, from: string | null, to: string) {
  const out = { knowledge: 0, practice: 0, execution: 0, total: 0 };
  for (const item of inputs.items) {
    if (item.source !== "activity") continue;
    if (item.date > to) break;
    if (from && item.date <= from) continue;
    const h = item.minutes / 60;
    out[item.component as ActivityMode] += h;
    out.total += h;
  }
  return out;
}
