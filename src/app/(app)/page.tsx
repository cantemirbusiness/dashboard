import { ArrowRight, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import { formatDate, toDate } from "@/lib/dates";
import { fmtHours, fmtScore } from "@/lib/format";
import { LineChart } from "@/components/charts/line-chart";
import { QuickAddButton } from "@/components/app/quick-add";
import { ActivityList } from "@/components/progress/activity-list";
import { ConsistencyCalendar, ConsistencyStats } from "@/components/progress/consistency";
import { DimensionBars, imbalanceSentence } from "@/components/progress/dimension-bars";
import { GoalRow } from "@/components/progress/goal-row";
import { NextActions } from "@/components/progress/next-actions";
import { Delta, EmptyState, Panel, Section, Stat } from "@/components/ui/display";
import { SkillStatusBadge } from "@/components/ui/status";

export const metadata = { title: "Overview" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function OverviewPage() {
  const { ws, engine } = await getEngine();
  const { analysis: a, metrics: m, recommendations, improvements30, weaknesses } = engine;
  const top = improvements30[0];
  const attention = weaknesses.find((w) => w.kind !== "goal" && w.kind !== "inconsistent") ?? weaknesses[0];
  const attentionSkill = attention?.key.includes(":") ? a.skillById.get(attention.key.split(":")[1]) : undefined;
  const activeGoals = a.goals.filter((g) => g.goal.state === "active").slice(0, 4);
  const recent = [...ws.activities].sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : x.occurredOn > y.occurredOn ? -1 : y.createdAt.localeCompare(x.createdAt))).slice(0, 6);
  const evidenceIds = new Set(ws.evidence.map((e) => e.activityId).filter((x): x is string => !!x));
  const imbalance = imbalanceSentence(a.dimensions.current);
  const name = ws.profile.displayName;

  if (a.skills.length === 0) {
    return (
      <EmptyState
        title="Start by adding the skills you want to grow"
        action={
          <Link href="/skills" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
            Add skills
          </Link>
        }
      >
        Your overall progress is calculated from your skills, the activity you log against them, and the evidence you collect.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-faint">
            {WEEKDAYS[toDate(a.today).getUTCDay()]}, {formatDate(a.today, { year: true })}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{name ? `Where you stand, ${name}` : "Where you stand"}</h1>
        </div>
        <QuickAddButton className="hidden h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent-strong sm:inline-flex">
          Log activity
        </QuickAddButton>
      </header>

      {/* Overall + next best action */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <Section title="Overall progress">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="tabular text-5xl font-semibold tracking-tight sm:text-6xl">{fmtScore(a.overall.score)}</span>
              <span className="text-lg text-faint">/ 100</span>
            </div>
            <div className="flex flex-col gap-0.5 pb-1.5 text-[13px]">
              <Delta value={a.overall.change} suffix="this month" className="text-[15px]" />
              <span className="text-faint">
                {a.overall.previous != null ? `${fmtScore(a.overall.previous)} thirty days ago` : "Not enough history for a 30-day comparison yet"}
              </span>
            </div>
          </div>
          {a.overall.series.length >= 3 ? (
            <div className="mt-4">
              <LineChart
                ariaLabel="Overall progress, weekly"
                height={150}
                series={[{ key: "overall", label: "Overall", color: "var(--accent)", points: a.overall.series }]}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-line-strong px-3 py-4 text-[13px] text-muted">
              A trend line appears after about three weeks of history. Keep logging activity.
            </p>
          )}
          <p className="mt-3 text-[13px] text-muted">
            {a.overall.explanation}{" "}
            <Link href="/insights#engine" className="text-accent hover:underline">
              How scores work
            </Link>
          </p>
        </Section>

        <Section title="Next best action" actions={<Link href="/insights" className="text-[12px] text-faint hover:text-fg">All insights</Link>}>
          <Panel className="p-4">
            <NextActions recs={recommendations.slice(0, 3)} />
          </Panel>
        </Section>
      </div>

      {/* Key metrics */}
      <Section title="Last 30 days">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-line py-4 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Productive hours" value={fmtHours(m.productiveHours30)} sub={`of ${fmtHours(m.totalHours30)} logged`} />
          <Stat label="Completed activities" value={m.completedActivities30} sub="completed or shipped" />
          <Stat label="Milestones" value={m.milestonesAchieved30} sub={`${m.milestonesAchieved} all time`} />
          <Stat label="Active projects" value={m.activeProjects} />
          <Stat label="Current streak" value={`${m.currentStreak}d`} sub={`best ${a.consistency.longestStreak}d`} />
          <Stat label="Skills improved" value={m.skillsImproved30} sub={`of ${a.skills.length}`} />
          <Stat label="Goals on track" value={`${m.goalsOnTrack}/${m.goalsActive}`} />
        </div>
      </Section>

      {/* Improvement vs attention */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        <Section title="Biggest improvement">
          {top ? (
            <Link href={`/skills/${top.skill.skill.id}`} className="group block">
              <div className="flex items-center gap-2 text-[13px] text-good">
                <TrendingUp size={14} aria-hidden /> {top.demonstrated ? "Demonstrated" : "Activity-based"}
              </div>
              <p className="mt-1 text-lg font-semibold group-hover:text-accent-strong">{top.skill.skill.name}</p>
              <p className="tabular text-[14px] text-muted">
                {fmtScore(top.from)} → {fmtScore(top.to)} <Delta value={top.delta} className="ml-1" /> this month
              </p>
              <ul className="mt-3 flex flex-col gap-1 text-[13px] text-muted">
                {top.drivers.slice(0, 3).map((d) => (
                  <li key={d.title} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {d.title}
                      {d.count > 1 ? <span className="text-faint"> ×{d.count}</span> : null}
                    </span>
                    <span className="tabular shrink-0 text-faint">+{d.contribution.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ) : (
            <p className="text-[13px] text-muted">No skill has moved meaningfully in the last 30 days yet.</p>
          )}
        </Section>

        <Section title="Needs attention">
          {attention ? (
            <Link href={attention.href ?? "/insights"} className="group block">
              <div className="flex items-center gap-2 text-[13px] text-critical">
                <AlertTriangle size={14} aria-hidden /> {attention.kind === "theory" ? "Theory-heavy" : attention.kind === "goal" ? "Goal slipping" : attention.kind === "neglected" ? "Neglected" : attention.kind === "declining" ? "Declining" : "Low"}
              </div>
              <p className="mt-1 text-lg font-semibold group-hover:text-accent-strong">
                {attention.title}
                {attention.score != null ? <span className="tabular ml-2 text-[14px] font-normal text-faint">{fmtScore(attention.score)} / 100</span> : null}
              </p>
              <p className="mt-1 text-[13px] text-muted">{attention.detail}</p>
              {attentionSkill ? <SkillStatusBadge status={attentionSkill.status} className="mt-2" /> : null}
            </Link>
          ) : (
            <p className="text-[13px] text-muted">Nothing stands out — every tracked skill is moving.</p>
          )}
          {weaknesses.length > 1 ? (
            <Link href="/evolution#needs-work" className="mt-3 inline-flex items-center gap-1 text-[12px] text-faint hover:text-fg">
              {weaknesses.length - 1} more areas <ArrowRight size={12} />
            </Link>
          ) : null}
        </Section>
      </div>

      {/* Knowledge vs execution + goals */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        <Section title="Knowledge vs execution" description="How full each part of your skill profile is (0–100). Tick = 30 days ago.">
          <DimensionBars current={a.dimensions.current} previous={a.dimensions.previous} />
          {imbalance ? <p className="mt-4 border-l-2 border-accent pl-3 text-[13px] text-muted">{imbalance}</p> : null}
        </Section>
        <Section title="Goals" actions={<Link href="/goals" className="text-[12px] text-faint hover:text-fg">All goals</Link>}>
          {activeGoals.length ? (
            <div className="-my-2.5 divide-y divide-line">
              {activeGoals.map((g) => (
                <GoalRow key={g.goal.id} g={g} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">
              No active goals. <Link href="/goals" className="text-accent hover:underline">Set one</Link> to focus recommendations.
            </p>
          )}
        </Section>
      </div>

      {/* Consistency + recent */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <Section title="Consistency">
          <ConsistencyStats c={a.consistency} weeklyGoal={ws.profile.weeklyHoursGoal} />
          <div className="mt-5">
            <ConsistencyCalendar c={a.consistency} />
          </div>
        </Section>
        <Section title="Recent activity" actions={<Link href="/activity" className="text-[12px] text-faint hover:text-fg">All activity</Link>}>
          {recent.length ? (
            <ActivityList activities={recent} evidenceIds={evidenceIds} />
          ) : (
            <EmptyState title="Nothing logged yet" action={<QuickAddButton className="text-sm text-accent">Log your first activity</QuickAddButton>}>
              Log what you did — it takes a few seconds.
            </EmptyState>
          )}
        </Section>
      </div>
    </div>
  );
}
