import type { Profile, Workspace } from "@/lib/domain";
import { generateDemoData } from "./generate";

/** An in-memory workspace built from demo data (tests and UI preview mode). */
export function demoWorkspace(today: string, profile?: Partial<Profile>): Workspace {
  let n = 0;
  const data = generateDemoData(today, () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, "0")}`);
  return {
    profile: { id: "preview", displayName: "Preview", timezone: "UTC", weeklyHoursGoal: 12, onboardedAt: today, ...profile },
    today,
    ...data,
    snapshots: [],
    insightStates: [],
  };
}
