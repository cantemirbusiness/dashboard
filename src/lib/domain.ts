// Domain model shared by the data layer, the Progress Engine and the UI.
// Dates are ISO calendar dates ("YYYY-MM-DD") in the user's timezone.

export const ACTIVITY_TYPES = [
  "learning",
  "coding",
  "project",
  "practice",
  "research",
  "english",
  "business",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_MODES = ["knowledge", "practice", "execution"] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

export const OUTCOMES = ["none", "partial", "completed", "shipped"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const PROJECT_STATUSES = ["planning", "active", "paused", "completed", "abandoned"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const GOAL_MEASURES = ["skills", "milestones", "manual"] as const;
export type GoalMeasure = (typeof GOAL_MEASURES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const GOAL_STATES = ["active", "completed", "abandoned"] as const;
export type GoalState = (typeof GOAL_STATES)[number];

export const EVIDENCE_KINDS = [
  "project",
  "repository",
  "deployment",
  "course",
  "assessment",
  "writeup",
  "implementation",
  "milestone",
  "real_world",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const CATEGORY_COLORS = ["violet", "blue", "aqua", "orange", "magenta", "yellow", "green", "red", "slate"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Default mode for each activity type — the form pre-selects it, the user can override. */
export const DEFAULT_MODE: Record<ActivityType, ActivityMode> = {
  learning: "knowledge",
  research: "knowledge",
  coding: "execution",
  project: "execution",
  practice: "practice",
  english: "practice",
  business: "practice",
  other: "practice",
};

export interface Profile {
  id: string;
  displayName: string | null;
  timezone: string;
  weeklyHoursGoal: number;
  onboardedAt: string | null;
}

export interface SkillCategory {
  id: string;
  name: string;
  color: CategoryColor;
  sortOrder: number;
  isDemo: boolean;
}

export interface Skill {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  baselineScore: number;
  targetScore: number;
  trackedSince: string;
  archived: boolean;
  isDemo: boolean;
}

export interface ProjectTrack {
  id: string;
  projectId: string;
  name: string;
  progress: number;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  manualProgress: number;
  startDate: string | null;
  targetDate: string | null;
  completedOn: string | null;
  output: string | null;
  notes: string | null;
  links: string[];
  skillIds: string[];
  tracks: ProjectTrack[];
  isDemo: boolean;
}

export interface Goal {
  id: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  horizon: "short" | "long";
  measure: GoalMeasure;
  unit: string | null;
  startValue: number;
  currentValue: number;
  targetValue: number;
  startDate: string;
  deadline: string | null;
  priority: Priority;
  state: GoalState;
  completedOn: string | null;
  skillIds: string[];
  projectIds: string[];
  isDemo: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  goalId: string | null;
  projectId: string | null;
  skillId: string | null;
  dueOn: string | null;
  achievedOn: string | null;
  significance: 1 | 2 | 3;
  isDemo: boolean;
}

export interface Activity {
  id: string;
  occurredOn: string;
  title: string;
  description: string | null;
  type: ActivityType;
  mode: ActivityMode;
  projectId: string | null;
  durationMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  outcome: Outcome;
  notes: string | null;
  skillIds: string[];
  isDemo: boolean;
  createdAt: string;
}

export interface Evidence {
  id: string;
  title: string;
  kind: EvidenceKind;
  url: string | null;
  description: string | null;
  assessmentScore: number | null;
  occurredOn: string;
  activityId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  skillIds: string[];
  isDemo: boolean;
}

export interface Snapshot {
  snapshotOn: string;
  key: string;
  score: number;
  engineVersion: string;
}

export interface InsightState {
  key: string;
  state: "dismissed" | "pinned";
}

/** Everything the Progress Engine needs, loaded once per request. */
export interface Workspace {
  profile: Profile;
  today: string;
  categories: SkillCategory[];
  skills: Skill[];
  projects: Project[];
  goals: Goal[];
  milestones: Milestone[];
  activities: Activity[];
  evidence: Evidence[];
  snapshots: Snapshot[];
  insightStates: InsightState[];
}
