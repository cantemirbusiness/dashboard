// Consistency: streaks, active days, weekly rhythm and a contribution calendar.
// Consistency is one input to skill scores (see config.CONSISTENCY_*) and is
// reported on its own — it is never the whole story.

import type { Activity } from "@/lib/domain";
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";

export interface WeekBucket {
  weekStart: string;
  minutes: number;
  activeDays: number;
  /** Minutes in practice + execution mode. */
  handsOnMinutes: number;
}

export interface ConsistencyResult {
  currentStreak: number;
  longestStreak: number;
  activeDays30: number;
  activeDaysPrev30: number;
  activeDaysThisWeek: number;
  activeDaysLastWeek: number;
  avgWeeklyHours: number; // last 4 full weeks + current partial week, per 7 days
  hoursThisWeek: number;
  weeks: WeekBucket[]; // oldest → newest, last 12 weeks
  /** date → minutes, covering the calendar window. */
  calendar: { date: string; minutes: number }[];
  calendarStart: string;
  totalActiveDays: number;
}

export function computeConsistency(activities: Activity[], today: string, calendarWeeks = 26): ConsistencyResult {
  const minutesByDay = new Map<string, number>();
  const handsOnByDay = new Map<string, number>();
  for (const a of activities) {
    if (a.occurredOn > today) continue;
    minutesByDay.set(a.occurredOn, (minutesByDay.get(a.occurredOn) ?? 0) + a.durationMinutes);
    if (a.mode !== "knowledge") {
      handsOnByDay.set(a.occurredOn, (handsOnByDay.get(a.occurredOn) ?? 0) + a.durationMinutes);
    }
  }
  const active = (d: string) => (minutesByDay.get(d) ?? 0) > 0;

  // Current streak: a streak is still alive if you were active yesterday but
  // have not logged anything yet today.
  let currentStreak = 0;
  let cursor = active(today) ? today : addDays(today, -1);
  while (active(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  const days = [...minutesByDay.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }

  const countActive = (from: string, to: string) => {
    let n = 0;
    for (const d of days) if (d >= from && d <= to) n++;
    return n;
  };

  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);

  const weeks: WeekBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    let minutes = 0;
    let handsOn = 0;
    let activeDays = 0;
    for (let d = 0; d < 7; d++) {
      const day = addDays(ws, d);
      const m = minutesByDay.get(day) ?? 0;
      minutes += m;
      handsOn += handsOnByDay.get(day) ?? 0;
      if (m > 0) activeDays++;
    }
    weeks.push({ weekStart: ws, minutes, activeDays, handsOnMinutes: handsOn });
  }

  let minutes28 = 0;
  for (let i = 0; i < 28; i++) minutes28 += minutesByDay.get(addDays(today, -i)) ?? 0;

  const calendarStart = addDays(thisWeek, -7 * (calendarWeeks - 1));
  const calendar: { date: string; minutes: number }[] = [];
  for (let d = calendarStart; d <= today; d = addDays(d, 1)) {
    calendar.push({ date: d, minutes: minutesByDay.get(d) ?? 0 });
  }

  return {
    currentStreak,
    longestStreak,
    activeDays30: countActive(addDays(today, -29), today),
    activeDaysPrev30: countActive(addDays(today, -59), addDays(today, -30)),
    activeDaysThisWeek: countActive(thisWeek, today),
    activeDaysLastWeek: countActive(lastWeek, addDays(thisWeek, -1)),
    avgWeeklyHours: minutes28 / 60 / 4,
    hoursThisWeek: weeks[weeks.length - 1].minutes / 60,
    weeks,
    calendar,
    calendarStart,
    totalActiveDays: days.length,
  };
}
