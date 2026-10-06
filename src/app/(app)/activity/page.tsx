import { Activity as ActivityIcon, ExternalLink, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import { ACTIVITY_MODES, ACTIVITY_TYPES } from "@/lib/domain";
import { addDays, formatDate } from "@/lib/dates";
import { EVIDENCE_LABEL, MODE_LABEL, TYPE_LABEL, fmtHours } from "@/lib/format";
import { QuickAddButton } from "@/components/app/quick-add";
import { AddEvidenceButton, EditEvidenceButton } from "@/components/forms/evidence-form";
import { ActivityList } from "@/components/progress/activity-list";
import { ConsistencyCalendar, ConsistencyStats, WeeklyHours } from "@/components/progress/consistency";
import { EmptyState, PageHeader, Section } from "@/components/ui/display";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Activity" };

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "Year", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

type Search = { range?: string; type?: string; mode?: string; skill?: string; page?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const type = ACTIVITY_TYPES.find((t) => t === sp.type);
  const mode = ACTIVITY_MODES.find((m) => m === sp.mode);
  const skill = ws.skills.find((s) => s.id === sp.skill);
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 60;

  const since = range.days ? addDays(a.today, -range.days) : null;
  const filtered = ws.activities
    .filter((x) => (!since || x.occurredOn > since) && (!type || x.type === type) && (!mode || x.mode === mode) && (!skill || x.skillIds.includes(skill.id)))
    .sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : x.occurredOn > y.occurredOn ? -1 : y.createdAt.localeCompare(x.createdAt)));
  const shown = filtered.slice(0, page * pageSize);
  const totalH = filtered.reduce((s, x) => s + x.durationMinutes, 0) / 60;
  const byMode = Object.fromEntries(ACTIVITY_MODES.map((m) => [m, filtered.filter((x) => x.mode === m).reduce((s, x) => s + x.durationMinutes, 0) / 60]));
  const evidenceIds = new Set(ws.evidence.map((e) => e.activityId).filter((x): x is string => !!x));
  const evidence = [...ws.evidence].sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : -1));

  const href = (patch: Partial<Search>) => {
    const next = { range: range.key, type, mode, skill: skill?.id, ...patch };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "range" && v === "90")) q.set(k, String(v));
    const s = q.toString();
    return s ? `/activity?${s}` : "/activity";
  };
  const chip = (active: boolean) =>
    cn("shrink-0 rounded-full border px-2.5 py-1 text-[12.5px]", active ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:text-fg");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Activity"
        description="Everything you've logged. Knowledge, practice and execution are weighted differently — see the dot color."
        actions={
          <QuickAddButton className="inline-flex h-10 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent-strong">
            Log activity
          </QuickAddButton>
        }
      />

      <Section title="Consistency">
        <ConsistencyStats c={a.consistency} weeklyGoal={ws.profile.weeklyHoursGoal} />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] text-faint">Hours per week · lighter = hands-on share</p>
            <WeeklyHours c={a.consistency} />
          </div>
          <div>
            <p className="mb-2 text-[12px] text-faint">Last 26 weeks</p>
            <ConsistencyCalendar c={a.consistency} />
          </div>
        </div>
      </Section>

      <Section title="Log">
        <div className="mb-4 flex flex-col gap-2">
          <nav aria-label="Time range" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {RANGES.map((r) => (
              <Link key={r.key} href={href({ range: r.key, page: undefined })} className={chip(range.key === r.key)} aria-current={range.key === r.key ? "true" : undefined}>
                {r.label}
              </Link>
            ))}
            <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
            {ACTIVITY_MODES.map((m) => (
              <Link key={m} href={href({ mode: mode === m ? undefined : m, page: undefined })} className={chip(mode === m)}>
                {MODE_LABEL[m]}
              </Link>
            ))}
          </nav>
          <nav aria-label="Activity type" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {ACTIVITY_TYPES.map((t) => (
              <Link key={t} href={href({ type: type === t ? undefined : t, page: undefined })} className={chip(type === t)}>
                {TYPE_LABEL[t]}
              </Link>
            ))}
          </nav>
          {skill ? (
            <p className="text-[13px] text-muted">
              Skill: <span className="text-fg">{skill.name}</span>{" "}
              <Link href={href({ skill: undefined })} className="text-faint underline">
                clear
              </Link>
            </p>
          ) : null}
        </div>
        <p className="mb-3 text-[13px] text-muted">
          <span className="tabular font-semibold text-fg">{filtered.length}</span> activities · <span className="tabular">{fmtHours(totalH)}</span>
          <span className="text-faint">
            {" "}
            — {fmtHours(byMode.knowledge)} knowledge · {fmtHours(byMode.practice)} practice · {fmtHours(byMode.execution)} execution
          </span>
        </p>
        {shown.length ? (
          <>
            <ActivityList activities={shown} evidenceIds={evidenceIds} groupByDay />
            {filtered.length > shown.length ? (
              <div className="mt-4 text-center">
                <Link href={href({ page: String(page + 1) })} scroll={false} className="text-[13px] text-accent hover:underline">
                  Show more ({filtered.length - shown.length} remaining)
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState icon={<ActivityIcon size={22} />} title={ws.activities.length ? "No activity matches these filters" : "Nothing logged yet"} action={<QuickAddButton className="text-sm text-accent">Log activity</QuickAddButton>}>
            {ws.activities.length ? "Try a wider time range." : "Press N anywhere (or the + button on mobile) to log what you did in a few seconds."}
          </EmptyState>
        )}
      </Section>

      <Section id="evidence" title="Evidence" description="Proof that supports your scores. Output (repos, deployments, results) weighs most." actions={<AddEvidenceButton />}>
        {evidence.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {evidence.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <FileCheck2 size={15} className="mt-0.5 shrink-0 text-good" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent-strong">
                        {e.title} <ExternalLink size={12} className="inline text-faint" aria-hidden />
                      </a>
                    ) : (
                      e.title
                    )}
                  </p>
                  <p className="text-[12px] text-faint">
                    {EVIDENCE_LABEL[e.kind]}
                    {e.assessmentScore != null ? ` · score ${e.assessmentScore}` : ""} · {formatDate(e.occurredOn, { year: true })}
                    {e.skillIds.length ? ` · ${e.skillIds.map((id) => a.skillById.get(id)?.skill.name).filter(Boolean).join(", ")}` : ""}
                  </p>
                </div>
                <EditEvidenceButton evidence={e} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No evidence yet.</p>
        )}
      </Section>
    </div>
  );
}
