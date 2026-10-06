import Link from "next/link";
import { notFound } from "next/navigation";
import { getEngine } from "@/lib/data/workspace";
import { formatDate, relativeDay } from "@/lib/dates";
import { fmtHours, fmtScore } from "@/lib/format";
import { QuickAddButton } from "@/components/app/quick-add";
import { AddEvidenceButton } from "@/components/forms/evidence-form";
import { AddMilestoneButton, MilestoneItem } from "@/components/forms/goal-forms";
import { EditProjectButton, TrackSlider } from "@/components/forms/project-forms";
import { EvidenceList } from "@/components/progress/evidence-list";
import { ActivityList } from "@/components/progress/activity-list";
import { Meter, Section, Stat } from "@/components/ui/display";
import { GoalStatusBadge, ProjectStatusBadge } from "@/components/ui/status";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const p = a.projects.find((x) => x.project.id === id);
  if (!p) notFound();
  const acts = ws.activities.filter((x) => x.projectId === id).sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : -1));
  const evidenceIds = new Set(ws.evidence.map((e) => e.activityId).filter((x): x is string => !!x));
  const goals = a.goals.filter((g) => g.goal.projectIds.includes(id));
  const proj = p.project;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Link href="/projects" className="text-[12px] text-faint hover:text-fg">
          ← Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{proj.name}</h1>
              <ProjectStatusBadge status={proj.status} />
            </div>
            {proj.description ? <p className="mt-1.5 max-w-2xl text-[13px] text-muted">{proj.description}</p> : null}
          </div>
          <div className="flex gap-2">
            <EditProjectButton project={proj} />
            <QuickAddButton projectId={id} className="inline-flex h-8 items-center rounded-md bg-accent px-2.5 text-[13px] font-medium text-accent-fg hover:bg-accent-strong">
              Log work
            </QuickAddButton>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-line py-4 sm:grid-cols-5">
        <Stat label="Progress" value={`${Math.round(p.progress)}%`} />
        <Stat label="Time invested" value={fmtHours(p.hours)} sub={`${fmtHours(p.hours30)} last 30d`} />
        <Stat label="Started" value={proj.startDate ? formatDate(proj.startDate) : "—"} sub={proj.startDate ? proj.startDate.slice(0, 4) : undefined} />
        <Stat
          label={proj.completedOn ? "Completed" : "Target"}
          value={proj.completedOn ? formatDate(proj.completedOn) : proj.targetDate ? formatDate(proj.targetDate) : "—"}
          sub={!proj.completedOn && proj.targetDate ? <span className={p.overdue ? "text-critical" : undefined}>{relativeDay(proj.targetDate, a.today)}</span> : undefined}
        />
        <Stat label="Evidence" value={p.evidence.length} sub={`${p.activityCount} activities`} />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Work streams" description={proj.tracks.length ? "Drag to update. Progress is the average of all streams." : undefined}>
          {proj.tracks.length ? (
            <div className="flex flex-col gap-2.5">
              {proj.tracks.map((t) => (
                <TrackSlider key={t.id + t.progress} track={t} />
              ))}
            </div>
          ) : (
            <div>
              <Meter value={p.progress} label="Progress" />
              <p className="mt-2 text-[13px] text-muted">Add work streams (Planning, Backend, Deployment…) via Edit to track progress per area.</p>
            </div>
          )}
        </Section>
        <Section title="Skills developed">
          {proj.skillIds.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {proj.skillIds.map((sid) => {
                const s = a.skillById.get(sid);
                return s ? (
                  <li key={sid}>
                    <Link href={`/skills/${sid}`} className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-[13px] text-muted hover:text-fg">
                      {s.skill.name} <span className="tabular text-faint">{fmtScore(s.score)}</span>
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Link skills so this project&apos;s completion counts as output for them.</p>
          )}
          {goals.length ? (
            <div className="mt-5">
              <p className="mb-1.5 text-[11.5px] text-faint">Supports goals</p>
              <ul className="flex flex-col gap-1">
                {goals.map((g) => (
                  <li key={g.goal.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <Link href={`/goals#${g.goal.id}`} className="truncate hover:text-accent-strong">
                      {g.goal.title}
                    </Link>
                    <GoalStatusBadge status={g.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Milestones" actions={<AddMilestoneButton projectId={id} label="Add" />}>
          {p.milestones.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {p.milestones.map((m) => (
                <MilestoneItem key={m.id} milestone={m} today={a.today} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No milestones yet.</p>
          )}
        </Section>
        <Section title="Output & evidence" actions={<AddEvidenceButton projectId={id} label="Add" variant="ghost" />}>
          {proj.output ? <p className="mb-3 text-[13px] text-muted">{proj.output}</p> : null}
          {p.evidence.length ? (
            <EvidenceList items={p.evidence} />
          ) : (
            <p className="text-[13px] text-muted">No evidence yet. A repository, deployment or demo makes this project count as demonstrated output.</p>
          )}
          {proj.links.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-[13px]">
              {proj.links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>

      {proj.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-[13px] text-muted">{proj.notes}</p>
        </Section>
      ) : null}

      <Section title="Activity" description={`${acts.length} sessions · ${fmtHours(p.hours)}`}>
        {acts.length ? <ActivityList activities={acts.slice(0, 20)} evidenceIds={evidenceIds} /> : <p className="text-[13px] text-muted">No work logged on this project yet.</p>}
      </Section>
    </div>
  );
}
