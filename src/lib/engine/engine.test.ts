import { describe, expect, it } from "vitest";
import type { Activity, Evidence, Goal, Skill, Workspace } from "@/lib/domain";
import { addDays } from "@/lib/dates";
import { demoWorkspace } from "@/lib/demo/workspace";
import { analyzeGoal, runEngine } from "@/lib/engine";
import { computeConsistency } from "./consistency";
import { COMPONENT_SHARE } from "./config";
import { activityPoints, buildSkillInputs, scoreSkill } from "./skills";

const TODAY = "2026-10-06";

const skill = (over: Partial<Skill> = {}): Skill => ({
  id: "s1",
  categoryId: null,
  name: "Backend",
  description: null,
  baselineScore: 20,
  targetScore: 80,
  trackedSince: "2026-01-01",
  archived: false,
  isDemo: false,
  ...over,
});

let seq = 0;
const activity = (over: Partial<Activity> = {}): Activity => ({
  id: `a${++seq}`,
  occurredOn: TODAY,
  title: "Session",
  description: null,
  type: "coding",
  mode: "execution",
  projectId: null,
  durationMinutes: 120,
  difficulty: 3,
  outcome: "partial",
  notes: null,
  skillIds: ["s1"],
  isDemo: false,
  createdAt: `${TODAY}T10:00:00Z`,
  ...over,
});

const evidence = (over: Partial<Evidence> = {}): Evidence => ({
  id: `e${++seq}`,
  title: "Deployed app",
  kind: "deployment",
  url: null,
  description: null,
  assessmentScore: null,
  occurredOn: TODAY,
  activityId: null,
  projectId: null,
  milestoneId: null,
  skillIds: ["s1"],
  isDemo: false,
  ...over,
});

function score(skills: Skill[], activities: Activity[], ev: Evidence[] = [], asOf = TODAY) {
  const inputs = buildSkillInputs({ skills, activities, evidence: ev, projects: [], milestones: [] });
  return scoreSkill(inputs.get(skills[0].id)!, asOf);
}

describe("activity points", () => {
  it("caps a single session and has diminishing returns", () => {
    const one = activityPoints({ durationMinutes: 60, mode: "practice", difficulty: 3, outcome: "partial" });
    const four = activityPoints({ durationMinutes: 240, mode: "practice", difficulty: 3, outcome: "partial" });
    const huge = activityPoints({ durationMinutes: 1200, mode: "practice", difficulty: 3, outcome: "partial" });
    const six = activityPoints({ durationMinutes: 360, mode: "practice", difficulty: 3, outcome: "partial" });
    expect(one).toBeCloseTo(1);
    expect(four).toBeLessThan(4 * one);
    expect(huge).toBe(six);
  });

  it("weights building above studying for the same time", () => {
    const base = { durationMinutes: 120, difficulty: 3 as const, outcome: "partial" as const };
    expect(activityPoints({ ...base, mode: "execution" })).toBeGreaterThan(activityPoints({ ...base, mode: "knowledge" }));
  });

  it("a 2h shipped build outweighs 5h of passive study", () => {
    const build = activityPoints({ durationMinutes: 120, mode: "execution", difficulty: 4, outcome: "shipped" });
    const study = activityPoints({ durationMinutes: 300, mode: "knowledge", difficulty: 2, outcome: "none" });
    expect(build).toBeGreaterThan(study);
  });
});

describe("skill score", () => {
  it("equals the baseline with no records", () => {
    const s = score([skill()], []);
    expect(s.score).toBe(20);
    expect(s.earned).toBe(0);
  });

  it("cannot be inflated by logging endless study hours", () => {
    const acts = Array.from({ length: 300 }, (_, i) =>
      activity({ mode: "knowledge", type: "learning", durationMinutes: 600, occurredOn: addDays(TODAY, -i) }),
    );
    const s = score([skill()], acts);
    const cap = 20 + 80 * COMPONENT_SHARE.knowledge;
    expect(s.score).toBeLessThanOrEqual(cap + 1e-9);
    expect(s.score).toBeGreaterThan(cap - 2);
  });

  it("never exceeds 100", () => {
    const acts = Array.from({ length: 400 }, (_, i) =>
      activity({ mode: (["knowledge", "practice", "execution"] as const)[i % 3], durationMinutes: 360, occurredOn: addDays(TODAY, -i) }),
    );
    const ev = Array.from({ length: 50 }, () => evidence({ kind: "real_world" }));
    const s = score([skill({ baselineScore: 90 })], acts, ev);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("rewards evidence and ignores records after the as-of date", () => {
    const acts = [activity({ occurredOn: "2026-09-01" })];
    const withoutEvidence = score([skill()], acts);
    const withEvidence = score([skill()], acts, [evidence({ occurredOn: "2026-09-20" })]);
    const beforeEvidence = score([skill()], acts, [evidence({ occurredOn: "2026-09-20" })], "2026-09-10");
    expect(withEvidence.score).toBeGreaterThan(withoutEvidence.score);
    expect(beforeEvidence.components.output.points).toBe(0);
  });

  it("decays activity with time but never below half weight", () => {
    const acts = [activity({ occurredOn: "2025-01-01" })];
    const fresh = score([skill({ trackedSince: "2025-01-01" })], acts, [], "2025-01-01");
    const old = score([skill({ trackedSince: "2025-01-01" })], acts, [], "2026-10-06");
    expect(old.components.execution.points).toBeLessThan(fresh.components.execution.points);
    expect(old.components.execution.points).toBeGreaterThanOrEqual(fresh.components.execution.points * 0.5 - 1e-9);
  });

  it("contributions add up to the earned score", () => {
    const acts = [activity(), activity({ mode: "knowledge" }), activity({ occurredOn: "2026-08-01" })];
    const s = score([skill()], acts, [evidence()]);
    const sum = s.contributions.reduce((a, c) => a + c.contribution, 0);
    expect(sum).toBeCloseTo(s.earned, 6);
  });

  it("splits an activity's time across its skills", () => {
    const a = activity({ skillIds: ["s1", "s2"] });
    const solo = score([skill()], [activity()]);
    const split = buildSkillInputs({ skills: [skill(), skill({ id: "s2", name: "DB" })], activities: [a], evidence: [], projects: [], milestones: [] });
    expect(split.get("s1")!.items[0].basePoints).toBeCloseTo(solo.components.execution.points / 2, 1);
  });
});

describe("consistency", () => {
  it("counts streaks, keeping today's streak alive until the day ends", () => {
    const acts = [-1, -2, -3, -10, -11].map((d) => activity({ occurredOn: addDays(TODAY, d) }));
    const c = computeConsistency(acts, TODAY);
    expect(c.currentStreak).toBe(3);
    expect(c.longestStreak).toBe(3);
    expect(c.totalActiveDays).toBe(5);
  });

  it("breaks the streak after a missed day", () => {
    const acts = [-2, -3].map((d) => activity({ occurredOn: addDays(TODAY, d) }));
    expect(computeConsistency(acts, TODAY).currentStreak).toBe(0);
  });
});

describe("goals", () => {
  const goal = (over: Partial<Goal>): Goal => ({
    id: "g1",
    categoryId: null,
    title: "Goal",
    description: null,
    horizon: "long",
    measure: "manual",
    unit: null,
    startValue: 0,
    currentValue: 50,
    targetValue: 100,
    startDate: addDays(TODAY, -50),
    deadline: addDays(TODAY, 50),
    priority: "medium",
    state: "active",
    completedOn: null,
    skillIds: [],
    projectIds: [],
    isDemo: false,
    ...over,
  });
  const noSkills = () => null;

  it("is on track when progress keeps pace with time", () => {
    expect(analyzeGoal(goal({}), [], TODAY, noSkills).status).toBe("on_track");
  });
  it("is behind when far below pace", () => {
    expect(analyzeGoal(goal({ currentValue: 10 }), [], TODAY, noSkills).status).toBe("behind");
  });
  it("is completed when the target is reached", () => {
    expect(analyzeGoal(goal({ currentValue: 100 }), [], TODAY, noSkills).status).toBe("completed");
  });
  it("is behind after a missed deadline", () => {
    const g = goal({ startDate: addDays(TODAY, -100), deadline: addDays(TODAY, -1), currentValue: 99 });
    expect(analyzeGoal(g, [], TODAY, noSkills).status).toBe("behind");
  });
});

describe("demo workspace", () => {
  const ws: Workspace = demoWorkspace(TODAY);
  const r = runEngine(ws);

  it("produces finite scores for every skill", () => {
    for (const s of r.analysis.skills) {
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(s.skill.baselineScore - 1e-9);
    }
    expect(r.analysis.overall.score).not.toBeNull();
  });

  it("generates deduplicated, data-backed recommendations", () => {
    expect(r.recommendations.length).toBeGreaterThan(0);
    const subjects = r.recommendations.flatMap((x) => x.subjects);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("detects the theory-heavy skill in the demo story", () => {
    const agents = r.analysis.skills.find((s) => s.skill.name === "Agents")!;
    expect(agents.theoryHeavy).toBe(true);
  });

  it("is deterministic", () => {
    const again = runEngine(demoWorkspace(TODAY));
    expect(again.analysis.overall.score).toBe(r.analysis.overall.score);
  });
});
