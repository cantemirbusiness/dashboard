import type { ConsistencyResult } from "@/lib/engine/consistency";
import { formatDate } from "@/lib/dates";
import { fmtHours } from "@/lib/format";
import { ContributionCalendar } from "@/components/charts/calendar";
import { BarChart } from "@/components/charts/bar-chart";
import { Stat } from "@/components/ui/display";

export function ConsistencyStats({ c, weeklyGoal }: { c: ConsistencyResult; weeklyGoal: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      <Stat label="Current streak" value={`${c.currentStreak}d`} sub={`Longest ${c.longestStreak}d`} />
      <Stat label="Active days (30d)" value={c.activeDays30} sub={`Prev. 30d: ${c.activeDaysPrev30}`} />
      <Stat label="This week" value={`${c.activeDaysThisWeek} days`} sub={`Last week: ${c.activeDaysLastWeek}`} />
      <Stat label="Avg / week (4w)" value={fmtHours(c.avgWeeklyHours)} sub={`Goal ${weeklyGoal}h`} />
    </div>
  );
}

export function ConsistencyCalendar({ c }: { c: ConsistencyResult }) {
  return <ContributionCalendar days={c.calendar} start={c.calendarStart} />;
}

export function WeeklyHours({ c }: { c: ConsistencyResult }) {
  return (
    <BarChart
      ariaLabel="Hours per week, last 12 weeks"
      bars={c.weeks.map((w) => ({
        label: formatDate(w.weekStart),
        value: w.minutes / 60,
        secondary: w.handsOnMinutes / 60,
        detail: `${fmtHours(w.handsOnMinutes / 60)} hands-on · ${w.activeDays} days`,
      }))}
      format="hours"
    />
  );
}
