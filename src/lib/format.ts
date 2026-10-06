import type { ActivityMode, ActivityType, CategoryColor, EvidenceKind, Outcome } from "@/lib/domain";

export const fmtScore = (n: number | null | undefined) => (n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1));
export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toString());

export function fmtHours(h: number): string {
  if (h <= 0) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 10) return `${(Math.round(h * 10) / 10).toString()}h`;
  return `${Math.round(h)}h`;
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const categoryColor = (c: CategoryColor | null | undefined) => `var(--s-${c ?? "slate"})`;

export const TYPE_LABEL: Record<ActivityType, string> = {
  learning: "Learning",
  coding: "Coding",
  project: "Project",
  practice: "Practice",
  research: "Research",
  english: "English",
  business: "Business",
  other: "Other",
};

export const MODE_LABEL: Record<ActivityMode, string> = {
  knowledge: "Knowledge",
  practice: "Practice",
  execution: "Execution",
};

export const MODE_HINT: Record<ActivityMode, string> = {
  knowledge: "Studying, reading, watching — weight 0.6×",
  practice: "Exercises, drills, deliberate reps — weight 1.0×",
  execution: "Building something real — weight 1.3×",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  none: "No outcome",
  partial: "Progress",
  completed: "Completed",
  shipped: "Shipped",
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  project: "Completed project",
  repository: "Repository",
  deployment: "Deployed app",
  course: "Course / module",
  assessment: "Assessment",
  writeup: "Written explanation",
  implementation: "Implementation",
  milestone: "Milestone",
  real_world: "Real-world result",
};

export const COMPONENT_LABEL = {
  knowledge: "Knowledge",
  practice: "Practice",
  execution: "Execution",
  demonstrated: "Demonstrated",
  output: "Real-world output",
} as const;

export const COMPONENT_HINT = {
  knowledge: "Studying and research (capped at 20% of growth)",
  practice: "Exercises and deliberate practice",
  execution: "Building real things",
  demonstrated: "Assessments, implementations, write-ups, milestones",
  output: "Repositories, deployments, completed projects, real results",
} as const;
