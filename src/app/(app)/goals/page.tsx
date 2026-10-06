import { Flag } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import type { GoalAnalysis } from "@/lib/engine";
import { formatDate } from "@/lib/dates";
import { fmtScore } from "@/lib/format";
import { LineChart } from "@/components/charts/line-chart";
import { AddGoalButton, AddMilestoneButton, EditGoalButton, GoalValueUpdater, MilestoneItem } from "@/components/forms/goal-forms";
import { fmtGoalValue } from "@/components/progress/goal-row";
import { EmptyState, Meter, PageHeader, Section } from "@/components/ui/display";
import { GoalStatusBadge } from "@/components/ui/status";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Goals" };

const STATUS_COLOR = { on_track: "var(--good)", at_risk: "var(--warning)", behind: "var(--critical)", completed: "var(--accent)", abandoned: "var(--fg-faint)" } as const;

export default async function GoalsPage() {
  const { engine } = await getEngine();
  const a = engine.analysis;
  const active = a.goals.filter((g) => g.goal.state === "active" && g.status !== "completed");
  const short = active.filter((g) => g.goal.horizon === "short");
  const long = active.filter((g) => g.goal.horizon === "long");
  const done = a.goals.filter((g) => g.goal.state !== "active" || g.status === "completed");
  const count = (s: string) => active.filter((g) => g.status === s).length;

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Status is calculated, not chosen: progress is compared with the time elapsed and your recent pace."
        actions={<AddGoalButton />}
      />
      {a.goals.length === 0 ? (
        <EmptyState icon={<Flag size={22} />} title="No goals yet" action={<AddGoalButton />}>
          Goals focus your recommendations and make linked skills count more in your overall score. Measure them by skill scores, milestones, or any number you track.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {active.length ? (
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
              <span>
                <span className="tabular font-semibold text-fg">{count("on_track")}</span> on track
              </span>
              <span>
                <span className="tabular font-semibold text-fg">{count("at_risk")}</span> at risk
              </span>
              <span>
                <span className="tabular font-semibold text-fg">{count("behind")}</span> behind
              </span>
              <span>
                <span className="tabular font-semibold text-fg">{done.filter((g) => g.status === "completed").length}</span> completed
              </span>
            </p>
          ) : null}
          {short.length ? (
            <Section title="Short-term">
              <GoalList goals={short} today={a.today} skillName={(id) => a.skillById.get(id)} />
            </Section>
          ) : null}
          {long.length ? (
            <Section title="Long-term">
              <GoalList goals={long} today={a.today} skillName={(id) => a.skillById.get(id)} />
            </Section>
          ) : null}
          {done.length ? (
            <Section title="Completed & closed">
              <ul className="divide-y divide-line border-y border-line">
                {done.map((g) => (
                  <li key={g.goal.id} id={g.goal.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="text-[14px]">{g.goal.title}</span>
                    <span className="flex items-center gap-3">
                      <GoalStatusBadge status={g.status} />
                      <EditGoalButton goal={g.goal} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GoalList({ goals, today, skillName }: { goals: GoalAnalysis[]; today: string; skillName: (id: string) => { skill: { name: string; id: string }; score: number } | undefined }) {
  return (
    <div className="flex flex-col gap-4">
      {goals.map((g) => (
        <article key={g.goal.id} id={g.goal.id} className="scroll-mt-20 rounded-lg border border-line bg-panel p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold leading-snug">{g.goal.title}</h3>
              {g.goal.description ? <p className="mt-0.5 text-[13px] text-muted">{g.goal.description}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-[11px] uppercase tracking-wide", g.goal.priority === "high" ? "text-accent" : "text-faint")}>{g.goal.priority} priority</span>
              <EditGoalButton goal={g.goal} />
            </div>
          </header>

          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <GoalStatusBadge status={g.status} className="text-[13px]" />
                <span className="tabular text-[13px] text-muted">
                  <span className="text-[18px] font-semibold text-fg">{fmtGoalValue(g, g.current)}</span> / {fmtGoalValue(g, g.target)}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11.5px] text-faint">
                  <span>Progress</span>
                  <span className="tabular">{Math.round(g.progress * 100)}%</span>
                </div>
                <Meter value={g.progress * 100} color={STATUS_COLOR[g.status]} label="Progress" />
              </div>
              {g.timeElapsed != null ? (
                <div>
                  <div className="mb-1 flex justify-between text-[11.5px] text-faint">
                    <span>Time used</span>
                    <span className="tabular">
                      {Math.round(g.timeElapsed * 100)}% · {g.daysLeft != null && g.daysLeft >= 0 ? `${g.daysLeft} days left` : "deadline passed"}
                    </span>
                  </div>
                  <Meter value={g.timeElapsed * 100} color="var(--fg-faint)" label="Time used" />
                </div>
              ) : null}
              <p className="text-[13px] text-muted">{g.statusReason}</p>
              <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
                <div>
                  <dt className="text-faint">Started</dt>
                  <dd className="tabular">{fmtGoalValue(g, g.start)} · {formatDate(g.goal.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-faint">Deadline</dt>
                  <dd>{g.goal.deadline ? formatDate(g.goal.deadline, { year: true }) : "None"}</dd>
                </div>
                <div>
                  <dt className="text-faint">Pace</dt>
                  <dd className="tabular">{g.velocity30 != null ? `${g.velocity30 >= 0 ? "+" : ""}${g.goal.measure === "manual" ? Math.round(g.velocity30) : g.velocity30.toFixed(1)} / 30d` : "—"}</dd>
                </div>
                {g.projectedAtDeadline != null ? (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-faint">Projected at deadline</dt>
                    <dd className="tabular">
                      {fmtGoalValue(g, g.projectedAtDeadline)} {g.projectedAtDeadline >= g.target ? <span className="text-good">— reaches target</span> : <span className="text-faint">— short of {fmtGoalValue(g, g.target)}</span>}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {g.goal.measure === "manual" ? <GoalValueUpdater goal={g.goal} /> : null}
            </div>

            <div className="flex flex-col gap-4">
              {g.trajectory && g.trajectory.length >= 3 ? (
                <div>
                  <p className="mb-1 text-[11.5px] text-faint">Trajectory</p>
                  <LineChart
                    ariaLabel={`${g.goal.title} trajectory`}
                    height={140}
                    valueFormat={g.goal.measure === "milestones" ? "percent" : g.goal.measure === "manual" ? { unit: g.goal.unit ?? "", position: (g.goal.unit ?? "").length <= 2 ? "prefix" : "suffix" } : "score"}
                    series={[
                      { key: "actual", label: "Actual", color: "var(--accent)", points: g.trajectory },
                      ...(g.goal.deadline
                        ? [{ key: "plan", label: "Required pace", color: "var(--fg-faint)", dashed: true, points: [{ date: g.goal.startDate, value: g.start }, { date: g.goal.deadline > today ? today : g.goal.deadline, value: g.start + (g.target - g.start) * (g.timeElapsed ?? 0) }] }]
                        : []),
                    ]}
                    reference={[{ value: g.target, label: `Target ${fmtGoalValue(g, g.target)}` }]}
                  />
                </div>
              ) : null}
              {g.goal.skillIds.length ? (
                <div>
                  <p className="mb-1.5 text-[11.5px] text-faint">Skills</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.goal.skillIds.map((id) => {
                      const s = skillName(id);
                      return s ? (
                        <li key={id}>
                          <Link href={`/skills/${id}`} className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-[12px] text-muted hover:text-fg">
                            {s.skill.name} <span className="tabular text-faint">{fmtScore(s.score)}</span>
                          </Link>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              ) : null}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11.5px] text-faint">Milestones {g.milestones.length ? `· ${g.milestones.filter((m) => m.achievedOn).length}/${g.milestones.length}` : ""}</p>
                  <AddMilestoneButton goalId={g.goal.id} label="Add" />
                </div>
                {g.milestones.length ? (
                  <ul className="divide-y divide-line">
                    {g.milestones.map((m) => (
                      <MilestoneItem key={m.id} milestone={m} today={today} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-faint">No milestones yet.</p>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
