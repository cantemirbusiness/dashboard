// Input validation for every mutation. Runs on the server inside each action;
// the database CHECK constraints are a second line of defence.

import { z } from "zod";
import {
  ACTIVITY_MODES,
  ACTIVITY_TYPES,
  CATEGORY_COLORS,
  EVIDENCE_KINDS,
  GOAL_MEASURES,
  GOAL_STATES,
  OUTCOMES,
  PRIORITIES,
  PROJECT_STATUSES,
} from "@/lib/domain";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const text = (max: number) => z.string().trim().min(1, "Required").max(max, `At most ${max} characters`);
const optText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `At most ${max} characters`).nullable().optional()).transform((v) => v ?? null);

const id = z.uuid("Invalid id");
const optId = z.preprocess(emptyToNull, id.nullable().optional()).transform((v) => v ?? null);
const date = z.iso.date("Use a valid date");
const optDate = z.preprocess(emptyToNull, date.nullable().optional()).transform((v) => v ?? null);
const url = z
  .string()
  .trim()
  .max(2000)
  .url("Enter a full URL starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed");
const optUrl = z.preprocess(emptyToNull, url.nullable().optional()).transform((v) => v ?? null);
const score = z.coerce.number().min(0).max(100);
const idList = (max: number) => z.array(id).max(max).default([]).transform((xs) => [...new Set(xs)]);

export const activitySchema = z.object({
  id: id.optional(),
  occurredOn: date,
  title: text(160),
  description: optText(4000),
  type: z.enum(ACTIVITY_TYPES),
  mode: z.enum(ACTIVITY_MODES),
  projectId: optId,
  durationMinutes: z.coerce.number().int().min(1, "At least 1 minute").max(1440, "At most 24 hours"),
  difficulty: z.coerce.number().int().min(1).max(5),
  outcome: z.enum(OUTCOMES),
  notes: optText(4000),
  skillIds: idList(10),
  /** Optional evidence created together with the activity. */
  evidence: z
    .object({ title: text(160), kind: z.enum(EVIDENCE_KINDS), url: optUrl })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type ActivityInput = z.input<typeof activitySchema>;

export const categorySchema = z.object({
  id: id.optional(),
  name: text(60),
  color: z.enum(CATEGORY_COLORS),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const skillSchema = z
  .object({
    id: id.optional(),
    name: text(80),
    categoryId: optId,
    description: optText(2000),
    baselineScore: score,
    targetScore: score,
    trackedSince: date,
    archived: z.boolean().default(false),
  })
  .refine((s) => s.targetScore >= s.baselineScore, { message: "Target should be at least the starting level", path: ["targetScore"] });
export type SkillInput = z.input<typeof skillSchema>;

export const projectSchema = z
  .object({
    id: id.optional(),
    name: text(120),
    description: optText(4000),
    status: z.enum(PROJECT_STATUSES),
    manualProgress: score.default(0),
    startDate: optDate,
    targetDate: optDate,
    completedOn: optDate,
    output: optText(4000),
    notes: optText(8000),
    links: z.array(url).max(20).default([]),
    skillIds: idList(30),
    tracks: z
      .array(z.object({ name: text(60), progress: score }))
      .max(12)
      .default([]),
  })
  .refine((p) => !p.startDate || !p.targetDate || p.targetDate >= p.startDate, {
    message: "Target date must be after the start date",
    path: ["targetDate"],
  });
export type ProjectInput = z.input<typeof projectSchema>;

export const goalSchema = z
  .object({
    id: id.optional(),
    title: text(160),
    description: optText(4000),
    categoryId: optId,
    horizon: z.enum(["short", "long"]),
    measure: z.enum(GOAL_MEASURES),
    unit: optText(20),
    startValue: z.coerce.number().min(-1e9).max(1e9).default(0),
    currentValue: z.coerce.number().min(-1e9).max(1e9).default(0),
    targetValue: z.coerce.number().min(-1e9).max(1e9),
    startDate: date,
    deadline: optDate,
    priority: z.enum(PRIORITIES),
    state: z.enum(GOAL_STATES).default("active"),
    skillIds: idList(30),
    projectIds: idList(20),
  })
  .refine((g) => !g.deadline || g.deadline >= g.startDate, { message: "Deadline must be after the start date", path: ["deadline"] })
  .refine((g) => g.measure !== "skills" || g.skillIds.length > 0, { message: "Pick at least one skill", path: ["skillIds"] })
  .refine((g) => g.measure !== "skills" || (g.targetValue >= 0 && g.targetValue <= 100), {
    message: "Skill-based targets are on the 0–100 scale",
    path: ["targetValue"],
  });
export type GoalInput = z.input<typeof goalSchema>;

export const milestoneSchema = z.object({
  id: id.optional(),
  title: text(160),
  description: optText(2000),
  goalId: optId,
  projectId: optId,
  skillId: optId,
  dueOn: optDate,
  achievedOn: optDate,
  significance: z.coerce.number().int().min(1).max(3),
});
export type MilestoneInput = z.input<typeof milestoneSchema>;

export const evidenceSchema = z
  .object({
    id: id.optional(),
    title: text(160),
    kind: z.enum(EVIDENCE_KINDS),
    url: optUrl,
    description: optText(2000),
    assessmentScore: z.preprocess(emptyToNull, score.nullable().optional()).transform((v) => v ?? null),
    occurredOn: date,
    projectId: optId,
    activityId: optId,
    milestoneId: optId,
    skillIds: idList(20),
  })
  .refine((e) => e.skillIds.length > 0 || e.projectId || e.activityId, {
    message: "Link at least one skill or project",
    path: ["skillIds"],
  });
export type EvidenceInput = z.input<typeof evidenceSchema>;

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z.object({
  displayName: optText(80),
  timezone: z.string().trim().max(64).refine(isValidTimeZone, "Unknown timezone"),
  weeklyHoursGoal: z.coerce.number().min(0).max(120),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email").max(320),
  password: z.string().min(8, "At least 8 characters").max(128),
});

export const emailSchema = z.object({ email: z.email("Enter a valid email").max(320) });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
