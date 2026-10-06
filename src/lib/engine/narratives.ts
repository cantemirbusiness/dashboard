// Deterministic narratives built on top of the analysis:
// improvements, weaknesses, achievements, timeline, next best actions and insights.
// Every sentence produced here is generated from data — no canned motivation.

import type { Activity, Milestone, Workspace } from "@/lib/domain";
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import type { Analysis, GoalAnalysis, SkillAnalysis } from "./analyze";
import type { Contribution } from "./skills";
import { STATUS } from "./config";

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt1(Math.abs(n))}`;
const hrs = (h: number) => (h < 0.05 ? "0h" : h >= 10 ? `${Math.round(h)}h` : `${fmt1(h)}h`);

// ---- What improved -----------------------------------------------------------

export interface Driver {
  source: Contribution["source"];
  title: string;
  component: Contribution["component"];
  /** How many records with this title (e.g. 6 sessions of the same work). */
  count: number;
  contribution: number;
  lastDate: string;
}

/** Group contributions with the same title so repeated sessions read as one line. */
export function groupDrivers(items: Contribution[]): Driver[] {
  const map = new Map<string, Driver>();
  for (const c of items) {
    const key = `${c.source}|${c.component}|${c.title}`;
    const d = map.get(key);
    if (d) {
      d.count++;
      d.contribution += c.contribution;
      if (c.date > d.lastDate) d.lastDate = c.date;
    } else {
      map.set(key, { source: c.source, title: c.title, component: c.component, count: 1, contribution: c.contribution, lastDate: c.date });
    }
  }
  return [...map.values()].sort((a, b) => b.contribution - a.contribution);
}

export interface Improvement {
  skill: SkillAnalysis;
  from: number;
  to: number;
  delta: number;
  /** Records dated inside the period (grouped), ranked by their contribution today. */
  drivers: Driver[];
  /** True when evidence, output or milestones in the period back the change. */
  demonstrated: boolean;
}

export function computeImprovements(a: Analysis, periodDays: number, limit = 6): Improvement[] {
  const since = addDays(a.today, -periodDays);
  const out: Improvement[] = [];
  for (const s of a.skills) {
    const from = a.skillAt(s.skill.id, since) ?? s.skill.baselineScore;
    const delta = s.score - from;
    if (delta < 0.5) continue;
    const drivers = groupDrivers(s.current.contributions.filter((c) => c.date > since && c.contribution > 0.01));
    const demonstrated = drivers.some((d) => d.component === "demonstrated" || d.component === "output");
    out.push({ skill: s, from, to: s.score, delta, drivers: drivers.slice(0, 5), demonstrated });
  }
  return out.sort((x, y) => y.delta - x.delta).slice(0, limit);
}

// ---- What needs work ---------------------------------------------------------

export type WeaknessKind = "low" | "stagnant" | "neglected" | "theory" | "goal" | "declining" | "inconsistent";

export interface Weakness {
  key: string;
  kind: WeaknessKind;
  title: string;
  detail: string;
  score?: number;
  href?: string;
  severity: number; // higher = more important
}

export function computeWeaknesses(a: Analysis): Weakness[] {
  const out: Weakness[] = [];
  for (const s of a.skills) {
    const href = `/skills/${s.skill.id}`;
    const goalLinked = s.weight > 1;
    const gap = s.skill.targetScore - s.score;
    if (s.theoryHeavy) {
      out.push({
        key: `theory:${s.skill.id}`,
        kind: "theory",
        title: s.skill.name,
        score: s.score,
        detail: `Lots of theory, little practice: ${hrs(s.hoursAll.knowledge)} studying vs ${hrs(s.hoursAll.execution)} building and ${s.evidence.length} piece${s.evidence.length === 1 ? "" : "s"} of evidence.`,
        href,
        severity: 60 + (goalLinked ? 20 : 0),
      });
    }
    if (s.status === "declining") {
      out.push({
        key: `declining:${s.skill.id}`,
        kind: "declining",
        title: s.skill.name,
        score: s.score,
        detail: `Down ${fmt1(Math.abs(s.delta30))} in 30 days${s.daysSinceActivity != null ? `; last worked on ${s.daysSinceActivity} days ago` : ""}.`,
        href,
        severity: 55 + (goalLinked ? 20 : 0),
      });
    }
    if (s.daysSinceActivity == null || s.daysSinceActivity > STATUS.stagnantAfterDays) {
      out.push({
        key: `neglected:${s.skill.id}`,
        kind: "neglected",
        title: s.skill.name,
        score: s.score,
        detail:
          s.daysSinceActivity == null
            ? "Never practised since you started tracking it."
            : `No activity for ${s.daysSinceActivity} days${goalLinked ? " even though an active goal depends on it" : ""}.`,
        href,
        severity: 40 + (goalLinked ? 25 : 0),
      });
    } else if (Math.abs(s.delta30) < 1 && s.daysSinceActivity > 14 && gap > 15) {
      out.push({
        key: `stagnant:${s.skill.id}`,
        kind: "stagnant",
        title: s.skill.name,
        score: s.score,
        detail: `Flat over 30 days (${signed(s.delta30)}) and ${fmt1(gap)} points short of target.`,
        href,
        severity: 35 + (goalLinked ? 15 : 0),
      });
    }
    if (s.score < STATUS.lowScore && gap >= STATUS.largeGap && !out.some((w) => w.key.endsWith(s.skill.id))) {
      out.push({
        key: `low:${s.skill.id}`,
        kind: "low",
        title: s.skill.name,
        score: s.score,
        detail: `${fmt1(s.score)} / 100 against a target of ${s.skill.targetScore}. ${hrs(s.hours90.total)} logged in the last 90 days.`,
        href,
        severity: 30 + gap / 3 + (goalLinked ? 15 : 0),
      });
    }
  }
  for (const g of a.goals) {
    if (g.status === "behind" || g.status === "at_risk") {
      out.push({
        key: `goal:${g.goal.id}`,
        kind: "goal",
        title: g.goal.title,
        detail: `${g.status === "behind" ? "Behind" : "At risk"} — ${g.statusReason}`,
        href: `/goals#${g.goal.id}`,
        severity: (g.status === "behind" ? 75 : 55) + (g.goal.priority === "high" ? 15 : 0),
      });
    }
  }
  const c = a.consistency;
  if (c.activeDays30 > 0 && c.activeDays30 < c.activeDaysPrev30 * 0.7) {
    out.push({
      key: "inconsistent:30",
      kind: "inconsistent",
      title: "Consistency",
      detail: `Active ${c.activeDays30} of the last 30 days, down from ${c.activeDaysPrev30} in the 30 days before.`,
      href: "/activity",
      severity: 45,
    });
  }
  return out.sort((x, y) => y.severity - x.severity);
}

// ---- Achievements & timeline ---------------------------------------------------

export interface TimelineEvent {
  key: string;
  date: string;
  kind: "milestone" | "achievement" | "project" | "evidence";
  title: string;
  detail?: string;
  href?: string;
}

/** Achievements derived automatically from data (never stored, never faked). */
export function computeAchievements(ws: Workspace, today: string): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const acts = [...ws.activities].filter((x) => x.occurredOn <= today).sort((x, y) => (x.occurredOn < y.occurredOn ? -1 : 1));
  if (acts.length) {
    out.push({ key: "ach:first-activity", date: acts[0].occurredOn, kind: "achievement", title: "First activity logged" });
  }
  // Practical hours thresholds (practice + execution).
  const thresholds = [10, 50, 100, 250, 500, 1000];
  let cum = 0;
  let ti = 0;
  for (const x of acts) {
    if (x.mode === "knowledge") continue;
    cum += x.durationMinutes / 60;
    while (ti < thresholds.length && cum >= thresholds[ti]) {
      out.push({
        key: `ach:practical-${thresholds[ti]}`,
        date: x.occurredOn,
        kind: "achievement",
        title: `${thresholds[ti]} hours of practical work`,
      });
      ti++;
    }
  }
  const completed = ws.projects.filter((p) => p.status === "completed" && p.completedOn).sort((x, y) => (x.completedOn! < y.completedOn! ? -1 : 1));
  if (completed.length) {
    out.push({ key: "ach:first-project", date: completed[0].completedOn!, kind: "achievement", title: "First project completed", detail: completed[0].name });
  }
  for (const p of completed) {
    out.push({ key: `proj:${p.id}`, date: p.completedOn!, kind: "project", title: `Completed ${p.name}`, href: `/projects/${p.id}` });
  }
  const firstOf = (kind: string) =>
    ws.evidence.filter((e) => e.kind === kind && e.occurredOn <= today).sort((x, y) => (x.occurredOn < y.occurredOn ? -1 : 1))[0];
  const dep = firstOf("deployment");
  if (dep) out.push({ key: "ach:first-deploy", date: dep.occurredOn, kind: "achievement", title: "First deployed application", detail: dep.title });
  const rw = firstOf("real_world");
  if (rw) out.push({ key: "ach:first-real-world", date: rw.occurredOn, kind: "achievement", title: "First real-world result", detail: rw.title });

  // Streak achievements.
  const days = [...new Set(acts.map((x) => x.occurredOn))].sort();
  const marks = [7, 30, 100];
  let run = 0;
  let prev: string | null = null;
  const reached = new Set<number>();
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    prev = d;
    for (const m of marks) {
      if (run >= m && !reached.has(m)) {
        reached.add(m);
        out.push({ key: `ach:streak-${m}`, date: d, kind: "achievement", title: `${m}-day streak` });
      }
    }
  }
  return out;
}

export function computeTimeline(ws: Workspace, today: string): TimelineEvent[] {
  const events = computeAchievements(ws, today);
  for (const m of ws.milestones) {
    if (m.achievedOn && m.achievedOn <= today) {
      events.push({ key: `ms:${m.id}`, date: m.achievedOn, kind: "milestone", title: m.title, detail: m.description ?? undefined });
    }
  }
  for (const e of ws.evidence) {
    if ((e.kind === "deployment" || e.kind === "real_world" || e.kind === "assessment") && e.occurredOn <= today) {
      events.push({ key: `ev:${e.id}`, date: e.occurredOn, kind: "evidence", title: e.title, detail: e.kind === "assessment" && e.assessmentScore != null ? `Score ${e.assessmentScore}` : undefined });
    }
  }
  return events.sort((x, y) => (x.date > y.date ? -1 : x.date < y.date ? 1 : 0));
}

// ---- Next best actions -------------------------------------------------------

export type Impact = "high" | "medium" | "low";

export interface Recommendation {
  key: string;
  title: string;
  impact: Impact;
  effort: string;
  reason: string;
  href?: string;
  priority: number;
  /** Skill / project / goal ids this action is about — used to avoid duplicates. */
  subjects: string[];
}

function estimateEffort(hours: number): string {
  if (hours <= 1) return "30–60 min";
  if (hours <= 2) return "1–2 hours";
  if (hours <= 3) return "2–3 hours";
  if (hours <= 6) return "half a day";
  return "1–2 days";
}

export function computeRecommendations(ws: Workspace, a: Analysis, limit = 3): Recommendation[] {
  const recs: Recommendation[] = [];
  const goalLinked = (s: SkillAnalysis) => s.weight > 1;

  // 1. Goals falling behind → their weakest linked skill.
  for (const g of a.goals) {
    if (g.status !== "behind" && g.status !== "at_risk") continue;
    const linked = g.goal.skillIds.map((id) => a.skillById.get(id)).filter((s): s is SkillAnalysis => !!s);
    const weakest = linked.sort((x, y) => x.score - x.skill.targetScore - (y.score - y.skill.targetScore))[0];
    const impact: Impact = g.status === "behind" || g.goal.priority === "high" ? "high" : "medium";
    if (weakest) {
      recs.push({
        key: `goal:${g.goal.id}:${weakest.skill.id}`,
        title: weakest.theoryHeavy ? `Build something real with ${weakest.skill.name}` : `Do a focused ${weakest.skill.name} session`,
        impact,
        effort: weakest.theoryHeavy ? "2–3 hours" : "1–2 hours",
        reason: `"${g.goal.title}" is ${g.status === "behind" ? "behind" : "at risk"} (${Math.round(g.progress * 100)}% done${g.timeElapsed != null ? `, ${Math.round(g.timeElapsed * 100)}% of time used` : ""}). ${weakest.skill.name} is its weakest skill at ${fmt1(weakest.score)}.`,
        href: `/skills/${weakest.skill.id}`,
        priority: (impact === "high" ? 88 : 70) + (g.goal.priority === "high" ? 2 : 0),
        subjects: [weakest.skill.id, g.goal.id],
      });
    } else if (g.goal.measure === "milestones") {
      const next = g.milestones.find((m) => !m.achievedOn);
      if (next) {
        recs.push({
          key: `goal-ms:${next.id}`,
          title: `Complete "${next.title}"`,
          impact,
          effort: "varies",
          reason: `"${g.goal.title}" is ${g.status === "behind" ? "behind" : "at risk"}; this is its next open milestone.`,
          href: `/goals#${g.goal.id}`,
          priority: impact === "high" ? 86 : 68,
          subjects: [next.id, g.goal.id],
        });
      }
    }
  }

  // 2. Active projects: finish the nearly-done ones, unblock the lagging track.
  for (const p of a.projects) {
    if (p.project.status !== "active") continue;
    const tracks = [...p.project.tracks].sort((x, y) => x.progress - y.progress);
    const lagging = tracks[0];
    const othersAvg = tracks.length > 1 ? tracks.slice(1).reduce((s, t) => s + t.progress, 0) / (tracks.length - 1) : 0;
    const perPct = p.progress > 5 && p.hours > 0 ? p.hours / p.progress : null;
    if (p.progress >= 70) {
      const remainingHours = perPct ? perPct * (100 - p.progress) : 4;
      recs.push({
        key: `finish:${p.project.id}`,
        title: lagging && lagging.progress < 100 ? `Finish ${p.project.name}: ${lagging.name.toLowerCase()}` : `Finish ${p.project.name}`,
        impact: "high",
        effort: estimateEffort(remainingHours),
        reason: `${p.project.name} is ${Math.round(p.progress)}% done. A completed project is the highest-weighted output in your skill scores${lagging ? `; ${lagging.name} (${Math.round(lagging.progress)}%) is what's left` : ""}.`,
        href: `/projects/${p.project.id}`,
        priority: 85,
        subjects: [p.project.id],
      });
    } else if (lagging && lagging.progress < 35 && othersAvg >= 55) {
      const matching = a.skills.find((s) => s.skill.name.toLowerCase().includes(lagging.name.toLowerCase()) || lagging.name.toLowerCase().includes(s.skill.name.toLowerCase()));
      const weakSkill = !!matching && matching.score < matching.skill.targetScore - 20;
      recs.push({
        key: `track:${lagging.id}`,
        title: /deploy/i.test(lagging.name) ? `Deploy ${p.project.name}` : `Push ${p.project.name} forward: ${lagging.name}`,
        impact: weakSkill ? "high" : "medium",
        effort: "2–3 hours",
        reason:
          `${lagging.name} is at ${Math.round(lagging.progress)}% while the rest of ${p.project.name} averages ${Math.round(othersAvg)}%.` +
          (matching ? ` ${matching.skill.name} is ${weakSkill ? "one of your weaker skills" : "a skill you track"} (${fmt1(matching.score)}).` : ""),
        href: `/projects/${p.project.id}`,
        // Doing the lagging work inside a real project beats an isolated session.
        priority: weakSkill ? 92 : 65,
        subjects: matching ? [p.project.id, matching.skill.id] : [p.project.id],
      });
    }
  }

  // 3. Theory-heavy skills.
  for (const s of a.skills) {
    if (!s.theoryHeavy) continue;
    recs.push({
      key: `theory:${s.skill.id}`,
      title: `Apply ${s.skill.name} in a small build`,
      impact: goalLinked(s) ? "high" : "medium",
      effort: "2–3 hours",
      reason: `${s.skill.name}: ${hrs(s.hoursAll.knowledge)} of study vs ${hrs(s.hoursAll.execution)} of building. Execution and output are worth up to 45% of a skill's growth; study caps at 20%.`,
      href: `/skills/${s.skill.id}`,
      priority: goalLinked(s) ? 80 : 55,
      subjects: [s.skill.id],
    });
  }

  // 4. Neglected goal-linked skills.
  for (const s of a.skills) {
    if (!goalLinked(s)) continue;
    if (s.daysSinceActivity != null && s.daysSinceActivity <= STATUS.neglectedAfterDays) continue;
    recs.push({
      key: `resume:${s.skill.id}`,
      title: `Resume ${s.skill.name}`,
      impact: "medium",
      effort: "30–60 min",
      reason:
        s.daysSinceActivity == null
          ? `${s.skill.name} supports an active goal but has no activity yet.`
          : `${s.skill.name} supports an active goal but hasn't been touched in ${s.daysSinceActivity} days; recent activity decays toward half weight.`,
      href: `/skills/${s.skill.id}`,
      priority: 60,
      subjects: [s.skill.id],
    });
  }

  // 5. Milestones due soon or overdue.
  for (const m of ws.milestones) {
    if (m.achievedOn || !m.dueOn) continue;
    const days = daysBetween(a.today, m.dueOn);
    if (days > 14) continue;
    recs.push({
      key: `milestone:${m.id}`,
      title: `Complete milestone: ${m.title}`,
      impact: days < 0 || m.significance === 3 ? "high" : "medium",
      effort: "varies",
      reason: days < 0 ? `It was due ${-days} days ago.` : `It is due ${days === 0 ? "today" : `in ${days} days`}.`,
      href: m.goalId ? `/goals#${m.goalId}` : m.projectId ? `/projects/${m.projectId}` : undefined,
      priority: days < 0 ? 78 : 62,
      subjects: [m.id, ...(m.skillId ? [m.skillId] : [])],
    });
  }

  // 6. Output gap at profile level.
  const d = a.dimensions.current;
  if (d.execution - d.output >= 15 || d.knowledge - d.output >= 25) {
    recs.push({
      key: "output-gap",
      title: "Turn recent work into evidence",
      impact: "medium",
      effort: "1 hour",
      reason: `Your real-world output index (${Math.round(d.output)}) trails execution (${Math.round(d.execution)}) and knowledge (${Math.round(d.knowledge)}). Publishing a repo, deploying, or writing up what you built converts effort into demonstrated skill.`,
      href: "/activity#evidence",
      priority: 58,
      subjects: ["output-gap"],
    });
  }

  // Dedupe by subject: keep the highest-priority action per skill/project/goal.
  const seen = new Set<string>();
  const sorted = recs.sort((x, y) => y.priority - x.priority);
  const out: Recommendation[] = [];
  for (const r of sorted) {
    if (r.subjects.some((s) => seen.has(s))) continue;
    r.subjects.forEach((s) => seen.add(s));
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- Insights ----------------------------------------------------------------

export type InsightCategory = "improvement" | "weakness" | "consistency" | "imbalance" | "goal" | "output" | "recommendation";

export interface Insight {
  key: string;
  category: InsightCategory;
  tone: "positive" | "negative" | "neutral";
  title: string;
  body: string;
  href?: string;
}

function sumHours(acts: Activity[], from: string, to: string, pred: (a: Activity) => boolean = () => true) {
  return acts.filter((x) => x.occurredOn > from && x.occurredOn <= to && pred(x)).reduce((s, x) => s + x.durationMinutes, 0) / 60;
}

export function computeInsights(ws: Workspace, a: Analysis, recs: Recommendation[]): Insight[] {
  const out: Insight[] = [];
  const t = a.today;
  const m30 = addDays(t, -30);
  const m60 = addDays(t, -60);
  const month = t.slice(0, 7);

  // Improvements & declines.
  for (const s of a.skills) {
    const before = a.skillAt(s.skill.id, m30);
    if (before == null) continue;
    if (s.delta30 >= 3) {
      const pct = before > 0 ? (s.delta30 / before) * 100 : 0;
      const top = groupDrivers(s.current.contributions.filter((c) => c.date > m30))[0];
      out.push({
        key: `improve:${s.skill.id}:${month}`,
        category: "improvement",
        tone: "positive",
        title: `${s.skill.name} improved ${Math.round(pct)}% over the last 30 days`,
        body: `${fmt1(before)} → ${fmt1(s.score)} (${signed(s.delta30)}).` + (top ? ` Biggest driver: ${top.title}${top.count > 1 ? ` ×${top.count}` : ""} (+${fmt1(top.contribution)}).` : ""),
        href: `/skills/${s.skill.id}`,
      });
    } else if (s.delta30 <= -1) {
      out.push({
        key: `decline:${s.skill.id}:${month}`,
        category: "weakness",
        tone: "negative",
        title: `${s.skill.name} slipped ${fmt1(Math.abs(s.delta30))} points`,
        body: `No recent activity means older work counts less (recency decay). Last activity: ${s.daysSinceActivity != null ? `${s.daysSinceActivity} days ago` : "never"}.`,
        href: `/skills/${s.skill.id}`,
      });
    }
  }

  // Practical attention comparison among goal-linked skills.
  const linked = a.skills.filter((s) => s.weight > 1);
  if (linked.length >= 2) {
    const byHandsOn = [...linked].sort((x, y) => x.hours90.execution + x.hours90.practice - (y.hours90.execution + y.hours90.practice));
    const low = byHandsOn[0];
    const high = byHandsOn[byHandsOn.length - 1];
    const lowH = low.hours90.execution + low.hours90.practice;
    const highH = high.hours90.execution + high.hours90.practice;
    if (highH >= 5 && highH >= lowH * 3) {
      out.push({
        key: `attention-gap:${low.skill.id}:${high.skill.id}:${month}`,
        category: "weakness",
        tone: "negative",
        title: `${low.skill.name} gets far less practical work than ${high.skill.name}`,
        body: `Last 90 days of hands-on work: ${hrs(lowH)} vs ${hrs(highH)}. Both support active goals.`,
        href: `/skills/${low.skill.id}`,
      });
    }
  }

  // Consistency.
  const c = a.consistency;
  const week = startOfWeek(t);
  if (c.activeDaysThisWeek > 0 || c.activeDaysLastWeek > 0) {
    const better = c.activeDaysThisWeek >= c.activeDaysLastWeek;
    out.push({
      key: `consistency-week:${week}`,
      category: "consistency",
      tone: better ? "positive" : "neutral",
      title: `Active ${c.activeDaysThisWeek} day${c.activeDaysThisWeek === 1 ? "" : "s"} this week vs ${c.activeDaysLastWeek} last week`,
      body: `${hrs(c.hoursThisWeek)} logged so far this week; your 4-week average is ${hrs(c.avgWeeklyHours)} per week against a goal of ${ws.profile.weeklyHoursGoal}h.`,
      href: "/activity",
    });
  }
  if (c.longestStreak >= 5 && c.currentStreak === c.longestStreak) {
    out.push({
      key: `streak-record:${c.longestStreak}`,
      category: "consistency",
      tone: "positive",
      title: `${c.currentStreak}-day streak — your longest so far`,
      body: "Consistency adds up to 15% to the growth of every skill you work on regularly.",
    });
  }

  // Imbalance: knowledge vs execution and output trends (last 30 vs previous 30).
  const k30 = sumHours(ws.activities, m30, t, (x) => x.mode === "knowledge");
  const kPrev = sumHours(ws.activities, m60, m30, (x) => x.mode === "knowledge");
  const x30 = sumHours(ws.activities, m30, t, (x) => x.mode === "execution");
  const xPrev = sumHours(ws.activities, m60, m30, (x) => x.mode === "execution");
  const ev30 = ws.evidence.filter((e) => e.occurredOn > m30 && e.occurredOn <= t).length;
  const evPrev = ws.evidence.filter((e) => e.occurredOn > m60 && e.occurredOn <= m30).length;
  if (k30 - kPrev >= 3 && x30 - xPrev < (k30 - kPrev) / 2) {
    out.push({
      key: `imbalance-knowledge:${month}`,
      category: "imbalance",
      tone: "negative",
      title: "Knowledge acquisition is growing faster than execution",
      body: `Study time ${hrs(kPrev)} → ${hrs(k30)} over the last two 30-day periods, while building time went ${hrs(xPrev)} → ${hrs(x30)}.`,
    });
  } else if (x30 > k30 && x30 >= 5) {
    out.push({
      key: `balance-execution:${month}`,
      category: "imbalance",
      tone: "positive",
      title: "You're building more than you're consuming",
      body: `${hrs(x30)} of execution vs ${hrs(k30)} of study in the last 30 days.`,
    });
  }
  const d = a.dimensions.current;
  if (d.knowledge - d.output >= 20) {
    out.push({
      key: `imbalance-dimensions:${month}`,
      category: "imbalance",
      tone: "negative",
      title: "Theory is ahead of real-world output",
      body: `Knowledge index ${Math.round(d.knowledge)} vs real-world output ${Math.round(d.output)}. Output (repos, deployments, results) is what turns effort into demonstrated skill.`,
    });
  }

  // Output.
  if (ev30 !== evPrev) {
    out.push({
      key: `output-evidence:${month}`,
      category: "output",
      tone: ev30 > evPrev ? "positive" : "negative",
      title: `${ev30} piece${ev30 === 1 ? "" : "s"} of evidence in the last 30 days (previous 30: ${evPrev})`,
      body: ev30 > evPrev ? "More of your progress is now demonstrated rather than claimed." : "Less of your recent progress is backed by evidence.",
      href: "/activity#evidence",
    });
  }
  const completed30 = ws.projects.filter((p) => p.completedOn && p.completedOn > m30 && p.completedOn <= t);
  for (const p of completed30) {
    out.push({
      key: `project-completed:${p.id}`,
      category: "output",
      tone: "positive",
      title: `Completed ${p.name}`,
      body: `Counts as real-world output for ${p.skillIds.length} skill${p.skillIds.length === 1 ? "" : "s"}.`,
      href: `/projects/${p.id}`,
    });
  }

  // Goals.
  for (const g of a.goals) {
    if (g.status === "behind" || g.status === "at_risk") {
      out.push({
        key: `goal:${g.goal.id}:${g.status}:${month}`,
        category: "goal",
        tone: "negative",
        title: `"${g.goal.title}" is ${g.status === "behind" ? "behind" : "at risk"}`,
        body: g.statusReason,
        href: `/goals#${g.goal.id}`,
      });
    }
  }
  const onTrack = a.goals.filter((g) => g.status === "on_track").length;
  const activeGoals = a.goals.filter((g) => g.goal.state === "active").length;
  if (activeGoals > 0) {
    out.push({
      key: `goals-summary:${month}`,
      category: "goal",
      tone: onTrack === activeGoals ? "positive" : "neutral",
      title: `${onTrack} of ${activeGoals} active goal${activeGoals === 1 ? "" : "s"} on track`,
      body: goalSummary(a.goals),
      href: "/goals",
    });
  }

  // Recommendation.
  if (recs[0]) {
    out.push({
      key: `rec:${recs[0].key}`,
      category: "recommendation",
      tone: "neutral",
      title: `Highest-impact next step: ${recs[0].title}`,
      body: recs[0].reason,
      href: recs[0].href,
    });
  }

  return out;
}

function goalSummary(goals: GoalAnalysis[]): string {
  const parts: string[] = [];
  const count = (s: string) => goals.filter((g) => g.status === s).length;
  if (count("behind")) parts.push(`${count("behind")} behind`);
  if (count("at_risk")) parts.push(`${count("at_risk")} at risk`);
  if (count("completed")) parts.push(`${count("completed")} completed`);
  return parts.length ? `${parts.join(", ")}.` : "Every active goal is on pace.";
}

// ---- Overview metrics --------------------------------------------------------

export interface OverviewMetrics {
  productiveHours30: number;
  totalHours30: number;
  productiveHoursPrev30: number;
  completedActivities30: number;
  milestonesAchieved: number;
  milestonesAchieved30: number;
  activeProjects: number;
  currentStreak: number;
  skillsImproved30: number;
  goalsOnTrack: number;
  goalsActive: number;
}

export function computeMetrics(ws: Workspace, a: Analysis): OverviewMetrics {
  const t = a.today;
  const m30 = addDays(t, -30);
  const m60 = addDays(t, -60);
  const handsOn = (x: Activity) => x.mode !== "knowledge";
  const achieved = (m: Milestone) => !!m.achievedOn && m.achievedOn <= t;
  return {
    productiveHours30: sumHours(ws.activities, m30, t, handsOn),
    totalHours30: sumHours(ws.activities, m30, t),
    productiveHoursPrev30: sumHours(ws.activities, m60, m30, handsOn),
    completedActivities30: ws.activities.filter((x) => x.occurredOn > m30 && x.occurredOn <= t && (x.outcome === "completed" || x.outcome === "shipped")).length,
    milestonesAchieved: ws.milestones.filter(achieved).length,
    milestonesAchieved30: ws.milestones.filter((m) => achieved(m) && m.achievedOn! > m30).length,
    activeProjects: ws.projects.filter((p) => p.status === "active").length,
    currentStreak: a.consistency.currentStreak,
    skillsImproved30: a.skills.filter((s) => s.delta30 >= 1).length,
    goalsOnTrack: a.goals.filter((g) => g.status === "on_track").length,
    goalsActive: a.goals.filter((g) => g.goal.state === "active").length,
  };
}
