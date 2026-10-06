import { describe, expect, it } from "vitest";
import { activitySchema, evidenceSchema, goalSchema, profileSchema, projectSchema } from "./validation";

const uuid = "11111111-1111-4111-8111-111111111111";
const today = new Date().toISOString().slice(0, 10);
const activity = {
  occurredOn: today,
  title: "Built the API",
  type: "coding",
  mode: "execution",
  durationMinutes: 60,
  difficulty: 3,
  outcome: "partial",
  skillIds: [uuid],
};

describe("validation", () => {
  it("accepts a normal activity and de-duplicates skills", () => {
    const r = activitySchema.parse({ ...activity, skillIds: [uuid, uuid] });
    expect(r.skillIds).toEqual([uuid]);
    expect(r.description).toBeNull();
  });

  it("rejects activities dated in the future or before 1970", () => {
    expect(activitySchema.safeParse({ ...activity, occurredOn: "2999-01-01" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...activity, occurredOn: "1969-12-31" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...activity, occurredOn: "2026-02-30" }).success).toBe(false);
  });

  it("only allows http(s) links", () => {
    const base = { title: "Demo", kind: "deployment", occurredOn: today, skillIds: [uuid] };
    expect(evidenceSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...base, url: "https://example.com" }).success).toBe(true);
    expect(evidenceSchema.safeParse({ ...base, url: "" }).data?.url).toBeNull();
  });

  it("requires evidence to be linked to something", () => {
    expect(evidenceSchema.safeParse({ title: "Demo", kind: "deployment", occurredOn: today }).success).toBe(false);
  });

  it("checks goal consistency", () => {
    const goal = { title: "Ship", horizon: "short", measure: "skills", targetValue: 70, startDate: today, priority: "high" };
    expect(goalSchema.safeParse(goal).success).toBe(false); // no skills
    expect(goalSchema.safeParse({ ...goal, skillIds: [uuid] }).success).toBe(true);
    expect(goalSchema.safeParse({ ...goal, skillIds: [uuid], targetValue: 150 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...goal, skillIds: [uuid], deadline: "2000-01-01" }).success).toBe(false);
  });

  it("rejects a project completed in the future but allows a future target date", () => {
    const p = { name: "App", status: "active", targetDate: "2099-01-01" };
    expect(projectSchema.safeParse(p).success).toBe(true);
    expect(projectSchema.safeParse({ ...p, completedOn: "2099-01-01" }).success).toBe(false);
  });

  it("validates timezones", () => {
    expect(profileSchema.safeParse({ timezone: "Europe/Dublin", weeklyHoursGoal: 10 }).success).toBe(true);
    expect(profileSchema.safeParse({ timezone: "Mars/Olympus", weeklyHoursGoal: 10 }).success).toBe(false);
  });
});
