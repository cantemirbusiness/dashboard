import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import { formatDate, relativeDay } from "@/lib/dates";
import { fmtHours } from "@/lib/format";
import type { ProjectAnalysis } from "@/lib/engine";
import { AddProjectButton } from "@/components/forms/project-forms";
import { EmptyState, Meter, PageHeader, Section } from "@/components/ui/display";
import { ProjectStatusBadge } from "@/components/ui/status";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { engine } = await getEngine();
  const a = engine.analysis;
  const open = a.projects.filter((p) => ["active", "planning", "paused"].includes(p.project.status));
  const closed = a.projects.filter((p) => !["active", "planning", "paused"].includes(p.project.status));
  const completed = a.projects.filter((p) => p.project.status === "completed");
  const totalHours = a.projects.reduce((s, p) => s + p.hours, 0);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Real output, separate from learning. Completed projects are the heaviest-weighted signal in your skill scores."
        actions={<AddProjectButton />}
      />
      {a.projects.length === 0 ? (
        <EmptyState icon={<FolderKanban size={22} />} title="No projects yet" action={<AddProjectButton />}>
          A project is anything you build or ship — an app, a deployment, a business experiment. Break it into work streams to track progress.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
            <span>
              <span className="tabular font-semibold text-fg">{open.filter((p) => p.project.status === "active").length}</span> active
            </span>
            <span>
              <span className="tabular font-semibold text-fg">{completed.length}</span> completed
            </span>
            <span>
              <span className="tabular font-semibold text-fg">{fmtHours(totalHours)}</span> invested
            </span>
          </p>
          {open.length ? (
            <Section title="In progress">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {open.map((p) => (
                  <ProjectCard key={p.project.id} p={p} today={a.today} />
                ))}
              </div>
            </Section>
          ) : null}
          {closed.length ? (
            <Section title="Completed & closed">
              <ul className="divide-y divide-line border-y border-line">
                {closed.map((p) => (
                  <li key={p.project.id}>
                    <Link href={`/projects/${p.project.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-hover/40 sm:px-2">
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium">{p.project.name}</span>
                        <span className="text-[12px] text-faint">
                          {p.project.completedOn ? `Completed ${formatDate(p.project.completedOn, { year: true })}` : "Closed"} · {fmtHours(p.hours)} · {p.evidence.length} evidence
                        </span>
                      </span>
                      <ProjectStatusBadge status={p.project.status} />
                    </Link>
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

function ProjectCard({ p, today }: { p: ProjectAnalysis; today: string }) {
  return (
    <Link href={`/projects/${p.project.id}`} className="group flex flex-col rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold group-hover:text-accent-strong">{p.project.name}</h3>
        <ProjectStatusBadge status={p.project.status} />
      </div>
      {p.project.description ? <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.project.description}</p> : null}
      <div className="mt-4 flex items-baseline justify-between text-[12px]">
        <span className="text-faint">Progress</span>
        <span className="tabular font-semibold">{Math.round(p.progress)}%</span>
      </div>
      <Meter value={p.progress} className="mt-1" label="Progress" />
      {p.project.tracks.length ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {p.project.tracks.map((t) => (
            <li key={t.id} className="grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-2 text-[12px]">
              <span className="truncate text-muted">{t.name}</span>
              <Meter value={t.progress} color={t.progress < 30 ? "var(--fg-faint)" : "var(--border-strong)"} className="h-1" />
              <span className="tabular text-right text-faint">{Math.round(t.progress)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-3 text-[12px] text-faint">
        <span>{fmtHours(p.hours)} total</span>
        <span>{fmtHours(p.hours30)} last 30d</span>
        {p.lastActivityOn ? <span>active {relativeDay(p.lastActivityOn, today)}</span> : null}
        {p.project.targetDate ? <span className={p.overdue ? "text-critical" : undefined}>{p.overdue ? "overdue" : `due ${relativeDay(p.project.targetDate, today)}`}</span> : null}
      </div>
    </Link>
  );
}
