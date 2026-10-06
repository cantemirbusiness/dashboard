import Link from "next/link";
import { notFound } from "next/navigation";
import { getEngine } from "@/lib/data/workspace";
import { addDays, formatDate, maxIso, relativeDay } from "@/lib/dates";
import { COMPONENTS, COMPONENT_SHARE, groupDrivers } from "@/lib/engine";
import { COMPONENT_HINT, COMPONENT_LABEL, categoryColor, fmtHours, fmtScore } from "@/lib/format";
import { LineChart } from "@/components/charts/line-chart";
import { QuickAddButton } from "@/components/app/quick-add";
import { AddEvidenceButton } from "@/components/forms/evidence-form";
import { EditSkillButton } from "@/components/forms/skill-forms";
import { EvidenceList } from "@/components/progress/evidence-list";
import { ActivityList } from "@/components/progress/activity-list";
import { Delta, EmptyState, Section, Stat, Tag } from "@/components/ui/display";
import { GoalStatusBadge, ProjectStatusBadge, SkillStatusBadge } from "@/components/ui/status";

export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const s = a.skillById.get(id);
  const raw = ws.skills.find((x) => x.id === id);
  if (!raw) notFound();

  if (!s) {
    // Archived skill: show a minimal page so it can be restored.
    return (
      <div>
        <h1 className="text-2xl font-semibold">{raw.name}</h1>
        <p className="mt-2 text-sm text-muted">This skill is archived and excluded from scores.</p>
        <div className="mt-4">
          <EditSkillButton skill={raw} />
        </div>
      </div>
    );
  }

  const start = maxIso(s.skill.trackedSince, addDays(a.today, -365));
  const step = Math.max(7, Math.ceil((Date.parse(a.today) - Date.parse(start)) / 86_400_000 / 40));
  const points: { date: string; value: number }[] = [];
  for (let d = a.today; d >= start; d = addDays(d, -step)) {
    const v = a.skillAt(id, d);
    if (v != null) points.unshift({ date: d, value: v });
  }
  if (points.length && points[0].date !== start) {
    const v = a.skillAt(id, start);
    if (v != null) points.unshift({ date: start, value: v });
  }

  const comp = s.current.components;
  const headroom = 100 - s.skill.baselineScore;
  const drivers = groupDrivers(s.current.contributions).slice(0, 8);
  const acts = ws.activities.filter((x) => x.skillIds.includes(id)).sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : -1));
  const evidenceIds = new Set(ws.evidence.map((e) => e.activityId).filter((x): x is string => !!x));
  const goals = a.goals.filter((g) => g.goal.skillIds.includes(id));
  const projects = a.projects.filter((p) => p.project.skillIds.includes(id));
  const change = s.score - s.skill.baselineScore;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Link href="/skills" className="text-[12px] text-faint hover:text-fg">
          ← Skills
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{s.skill.name}</h1>
              {s.category ? <Tag color={categoryColor(s.category.color)}>{s.category.name}</Tag> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <SkillStatusBadge status={s.status} />
              <span className="text-faint">{s.lastActivityOn ? `Last activity ${relativeDay(s.lastActivityOn, a.today)}` : "No activity yet"}</span>
            </div>
            {s.skill.description ? <p className="mt-2 max-w-2xl text-[13px] text-muted">{s.skill.description}</p> : null}
          </div>
          <div className="flex gap-2">
            <EditSkillButton skill={s.skill} />
            <QuickAddButton skillId={id} className="inline-flex h-8 items-center rounded-md bg-accent px-2.5 text-[13px] font-medium text-accent-fg hover:bg-accent-strong">
              Log activity
            </QuickAddButton>
          </div>
        </div>
        {s.status === "needs_attention" || s.status === "declining" || s.status === "stagnating" ? (
          <ul className="mt-3 flex flex-col gap-1 border-l-2 border-critical/60 pl-3 text-[13px] text-muted">
            {s.statusReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-line py-4 sm:grid-cols-5">
        <Stat label="Starting" value={fmtScore(s.skill.baselineScore)} sub={formatDate(s.skill.trackedSince, { year: true })} />
        <Stat label="Current" value={fmtScore(s.score)} sub={<Delta value={s.delta30} suffix="30d" />} />
        <Stat label="Target" value={s.skill.targetScore} sub={`${fmtScore(Math.max(0, s.skill.targetScore - s.score))} to go`} />
        <Stat label="Change since start" value={<Delta value={change} className="text-lg sm:text-xl" />} />
        <Stat label="Confidence" value={<span className="capitalize">{s.confidence}</span>} sub={`${s.evidence.length} evidence`} />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section title="Score over time" description={points.length < 3 ? undefined : "Rebuilt from your dated records — each point only uses what existed on that day."}>
          {points.length >= 3 ? (
            <LineChart
              ariaLabel={`${s.skill.name} score over time`}
              height={220}
              yDomain={[0, Math.min(100, Math.max(s.skill.targetScore, ...points.map((p) => p.value)) + 10)]}
              series={[{ key: "score", label: s.skill.name, color: categoryColor(s.category?.color), points }]}
              reference={[
                { value: s.skill.targetScore, label: `Target ${s.skill.targetScore}` },
                { value: s.skill.baselineScore, label: "Start" },
              ]}
            />
          ) : (
            <p className="rounded-md border border-dashed border-line-strong px-3 py-6 text-[13px] text-muted">
              This skill has been tracked for less than three weeks. The chart appears once there is enough history.
            </p>
          )}
        </Section>

        <Section title="Why this score" description="Starting level plus what you've earned in each component.">
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-2 text-muted">Starting level (self-assessed)</td>
                <td className="tabular py-2 text-right">{fmtScore(s.skill.baselineScore)}</td>
              </tr>
              {COMPONENTS.map((c) => (
                <tr key={c}>
                  <td className="py-2">
                    <span title={COMPONENT_HINT[c]}>{COMPONENT_LABEL[c]}</span>
                    <span className="block text-[11.5px] text-faint">
                      {comp[c].points.toFixed(1)} pts · {Math.round(comp[c].saturation * 100)}% of max {fmtScore(headroom * COMPONENT_SHARE[c])}
                    </span>
                  </td>
                  <td className="tabular py-2 text-right">+{comp[c].contribution.toFixed(1)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-muted">
                  Consistency multiplier
                  <span className="block text-[11.5px] text-faint">
                    active {s.current.consistency.activeWeeks} of last {s.current.consistency.windowWeeks} weeks (already applied above)
                  </span>
                </td>
                <td className="tabular py-2 text-right">×{s.current.consistency.multiplier.toFixed(2)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2">Current score</td>
                <td className="tabular py-2 text-right">{fmtScore(s.score)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-faint">{s.confidenceReason}</p>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="What built this score" description="Records ranked by how many points they contribute today.">
          {drivers.length ? (
            <ul className="divide-y divide-line border-y border-line text-[13px]">
              {drivers.map((d) => (
                <li key={d.title + d.component} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {d.title}
                      {d.count > 1 ? <span className="text-faint"> ×{d.count}</span> : null}
                    </span>
                    <span className="text-[11.5px] text-faint">
                      {COMPONENT_LABEL[d.component]} · {relativeDay(d.lastDate, a.today)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-muted">+{d.contribution.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nothing yet — the score equals your starting level.</p>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
            {(["knowledge", "practice", "execution"] as const).map((m) => (
              <div key={m}>
                <dt className="text-faint">{COMPONENT_LABEL[m]}</dt>
                <dd className="tabular text-muted">
                  {fmtHours(s.hoursAll[m])} <span className="text-faint">({fmtHours(s.hours90[m])} 90d)</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Evidence supporting this score" actions={<AddEvidenceButton skillId={id} />}>
          {s.evidence.length ? (
            <EvidenceList items={s.evidence} />
          ) : (
            <EmptyState title="No evidence yet" className="py-6">
              Without evidence, this score rests on your starting level and logged time. Add a repo, deployment, assessment or write-up to make it trustworthy.
            </EmptyState>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Goals">
          {goals.length ? (
            <ul className="divide-y divide-line border-y border-line text-[13px]">
              {goals.map((g) => (
                <li key={g.goal.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/goals#${g.goal.id}`} className="min-w-0 truncate hover:text-accent-strong">
                    {g.goal.title}
                  </Link>
                  <GoalStatusBadge status={g.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Not linked to any goal. Skills tied to goals weigh more in your overall score.</p>
          )}
        </Section>
        <Section title="Projects">
          {projects.length ? (
            <ul className="divide-y divide-line border-y border-line text-[13px]">
              {projects.map((p) => (
                <li key={p.project.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/projects/${p.project.id}`} className="min-w-0 truncate hover:text-accent-strong">
                    {p.project.name}
                  </Link>
                  <ProjectStatusBadge status={p.project.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No projects use this skill yet. Real projects carry the most weight.</p>
          )}
        </Section>
      </div>

      <Section title="Recent activity" description={`${acts.length} activities in total`}>
        {acts.length ? <ActivityList activities={acts.slice(0, 12)} evidenceIds={evidenceIds} /> : <p className="text-[13px] text-muted">No activity logged for this skill yet.</p>}
      </Section>

    </div>
  );
}
