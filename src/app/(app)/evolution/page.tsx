import { AlertTriangle, Award, CheckCircle2, FileCheck2, Flag, History, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import { addDays, daysBetween, formatDate, formatMonth, maxIso, startOfWeek } from "@/lib/dates";
import { COMPONENTS, ENGINE_VERSION, computeImprovements, type TimelineEvent } from "@/lib/engine";
import { COMPONENT_LABEL, fmtHours, fmtScore } from "@/lib/format";
import { BarChart } from "@/components/charts/bar-chart";
import { Legend, LineChart } from "@/components/charts/line-chart";
import { Delta, Meter, PageHeader, Section, Tag } from "@/components/ui/display";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Evolution" };

const RANGES = [
  { key: "30", label: "Month", days: 30 },
  { key: "90", label: "Quarter", days: 90 },
  { key: "365", label: "Year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

const SERIES = ["var(--s-blue)", "var(--s-orange)", "var(--s-aqua)", "var(--s-yellow)", "var(--s-magenta)", "var(--s-green)", "var(--s-violet)", "var(--s-red)"];

export default async function EvolutionPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rk } = await searchParams;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const range = RANGES.find((r) => r.key === rk) ?? RANGES[1];
  const earliest = a.history.earliest ?? a.today;
  const from = range.days ? maxIso(earliest, addDays(a.today, -range.days)) : earliest;
  const span = Math.max(1, daysBetween(from, a.today));
  const step = span <= 45 ? 1 : span <= 120 ? 3 : 7;

  const dates: string[] = [];
  for (let d = a.today; d >= from; d = addDays(d, -step)) dates.unshift(d);
  if (dates[0] !== from) dates.unshift(from);

  const overall = dates.map((d) => ({ date: d, value: a.overallAt(d) ?? 0 }));
  const periodDays = range.days ?? Math.max(1, daysBetween(earliest, a.today));
  const improvements = computeImprovements(a, periodDays, 8);

  // Stable color per skill (by position in the full list) so colors follow the entity.
  const colorOf = new Map(a.skills.map((s, i) => [s.skill.id, SERIES[i % SERIES.length]]));
  const movers = [...a.skills]
    .map((s) => ({ s, change: s.score - (a.skillAt(s.skill.id, from) ?? s.skill.baselineScore) }))
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
    .slice(0, 5);
  const skillSeries = movers.map(({ s }) => ({
    key: s.skill.id,
    label: s.skill.name,
    color: colorOf.get(s.skill.id)!,
    points: dates.filter((d) => d >= s.skill.trackedSince).map((d) => ({ date: d, value: a.skillAt(s.skill.id, d) ?? s.skill.baselineScore })),
  }));

  const dimColors: Record<(typeof COMPONENTS)[number], string> = {
    knowledge: SERIES[0],
    practice: SERIES[2],
    execution: SERIES[1],
    demonstrated: SERIES[6],
    output: SERIES[4],
  };
  const dimSeries = COMPONENTS.map((c) => ({
    key: c,
    label: COMPONENT_LABEL[c],
    color: dimColors[c],
    points: dates.map((d) => ({ date: d, value: a.dimensionsAt(d)?.[c] ?? 0 })),
  }));

  // Weekly hours over the range.
  const weeks: { label: string; value: number; secondary: number; detail: string }[] = [];
  for (let w = startOfWeek(from); w <= a.today; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const acts = ws.activities.filter((x) => x.occurredOn >= w && x.occurredOn <= end);
    const total = acts.reduce((s, x) => s + x.durationMinutes, 0) / 60;
    const hands = acts.filter((x) => x.mode !== "knowledge").reduce((s, x) => s + x.durationMinutes, 0) / 60;
    weeks.push({ label: formatDate(w), value: total, secondary: hands, detail: `${fmtHours(hands)} hands-on` });
  }

  // Output trend: cumulative completed projects, milestones, evidence.
  const cumulative = (datesOf: string[]) => dates.map((d) => ({ date: d, value: datesOf.filter((x) => x <= d).length }));
  const outputSeries = [
    { key: "evidence", label: "Evidence", color: SERIES[0], points: cumulative(ws.evidence.map((e) => e.occurredOn)) },
    { key: "milestones", label: "Milestones achieved", color: SERIES[1], points: cumulative(ws.milestones.flatMap((m) => (m.achievedOn ? [m.achievedOn] : []))) },
    { key: "projects", label: "Projects completed", color: SERIES[2], points: cumulative(ws.projects.flatMap((p) => (p.completedOn ? [p.completedOn] : []))) },
  ];

  const timeline = engine.timeline.filter((e) => e.date >= from);
  const months = new Map<string, TimelineEvent[]>();
  for (const e of timeline) months.set(e.date.slice(0, 7), [...(months.get(e.date.slice(0, 7)) ?? []), e]);

  const snapshotDays = new Set(ws.snapshots.map((s) => s.snapshotOn));
  const firstSnapshot = ws.snapshots[0]?.snapshotOn;
  const enough = a.history.sufficient && dates.length >= 3;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Evolution"
        description="How you have changed. Every historical point is recomputed from records dated on or before that day — nothing is interpolated or invented."
        actions={
          <nav aria-label="Time range" className="flex rounded-md border border-line p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={r.key === "90" ? "/evolution" : `/evolution?range=${r.key}`}
                aria-current={range.key === r.key ? "true" : undefined}
                className={cn("rounded px-2.5 py-1 text-[13px]", range.key === r.key ? "bg-hover text-fg" : "text-faint hover:text-fg")}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        }
      />

      {!enough ? (
        <div className="flex gap-3 rounded-lg border border-dashed border-line-strong p-4 text-[13px] text-muted">
          <History size={18} className="mt-0.5 shrink-0 text-faint" aria-hidden />
          <div>
            <p className="font-medium text-fg">Not enough history yet</p>
            <p className="mt-1">
              You have {a.history.days} day{a.history.days === 1 ? "" : "s"} of data. Trends become meaningful after about two weeks. To build a useful history: log activity on the days you work,
              attach evidence when you finish something, and mark milestones as you reach them. If you started before using this app, set each skill&apos;s &quot;tracked since&quot; date and backfill key
              activities with their real dates.
            </p>
          </div>
        </div>
      ) : null}

      <Section title="Overall progress" description={`${formatDate(from, { year: true })} → today`}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="tabular text-2xl font-semibold">
            {fmtScore(overall[0]?.value)} → {fmtScore(a.overall.score)}
          </span>
          <Delta value={(a.overall.score ?? 0) - (overall[0]?.value ?? 0)} suffix={`over ${range.label.toLowerCase()}`} />
        </div>
        {enough ? <LineChart ariaLabel="Overall progress over time" height={220} series={[{ key: "overall", label: "Overall", color: "var(--accent)", points: overall }]} /> : null}
      </Section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Biggest movers" description="The five skills that changed most in this period.">
          <Legend items={skillSeries.map((s) => ({ label: s.label, color: s.color }))} />
          {enough ? (
            <div className="mt-3">
              <LineChart ariaLabel="Skill progression" height={240} series={skillSeries} />
            </div>
          ) : null}
        </Section>
        <Section title="Knowledge → output" description="Profile-wide index of each component (0–100).">
          <Legend items={dimSeries.map((s) => ({ label: s.label, color: s.color }))} />
          {enough ? (
            <div className="mt-3">
              <LineChart ariaLabel="Knowledge, practice, execution, demonstrated and output over time" height={240} series={dimSeries} />
            </div>
          ) : null}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Activity trend" description="Hours per week · darker bar = hands-on (practice + execution).">
          <BarChart ariaLabel="Hours per week" bars={weeks} format="hours" highlightLast={false} />
        </Section>
        <Section title="Output trend" description="Cumulative evidence, milestones and completed projects.">
          <Legend items={outputSeries.map((s) => ({ label: s.label, color: s.color }))} />
          <div className="mt-3">
            <LineChart ariaLabel="Cumulative output" height={180} series={outputSeries} valueFormat="int" />
          </div>
        </Section>
      </div>

      <Section title="Starting point → current → target">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_56px_56px_56px_64px_minmax(0,1.4fr)] gap-x-4 border-b border-line pb-2 text-[11px] uppercase tracking-wide text-faint md:grid">
          <span>Skill</span>
          <span className="text-right">Start</span>
          <span className="text-right">Now</span>
          <span className="text-right">Target</span>
          <span className="text-right">Change</span>
          <span>Distance to target</span>
        </div>
        <ul className="divide-y divide-line">
          {a.skills.map((s) => {
            const change = s.score - s.skill.baselineScore;
            const covered = s.skill.targetScore > s.skill.baselineScore ? (change / (s.skill.targetScore - s.skill.baselineScore)) * 100 : 100;
            return (
              <li key={s.skill.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 text-[13px] md:grid-cols-[minmax(0,1.3fr)_56px_56px_56px_64px_minmax(0,1.4fr)]">
                <Link href={`/skills/${s.skill.id}`} className="truncate font-medium hover:text-accent-strong">
                  {s.skill.name}
                </Link>
                <span className="tabular text-right text-muted md:hidden">
                  {fmtScore(s.skill.baselineScore)} → <span className="text-fg">{fmtScore(s.score)}</span> / {s.skill.targetScore}
                </span>
                <span className="tabular hidden text-right text-faint md:block">{fmtScore(s.skill.baselineScore)}</span>
                <span className="tabular hidden text-right font-semibold md:block">{fmtScore(s.score)}</span>
                <span className="tabular hidden text-right text-faint md:block">{s.skill.targetScore}</span>
                <span className="hidden justify-end md:flex">
                  <Delta value={change} />
                </span>
                <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <Meter value={s.score} baseline={s.skill.baselineScore} target={s.skill.targetScore} color={colorOf.get(s.skill.id)} />
                  <span className="tabular w-10 shrink-0 text-right text-[12px] text-faint">{Math.max(0, Math.min(100, Math.round(covered)))}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="What improved" description={`Over the last ${range.days ?? periodDays} days, and the records behind it.`}>
          {improvements.length ? (
            <ul className="flex flex-col gap-5">
              {improvements.map((imp) => (
                <li key={imp.skill.skill.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/skills/${imp.skill.skill.id}`} className="font-medium hover:text-accent-strong">
                      {imp.skill.skill.name}
                    </Link>
                    <span className="tabular text-[13px] text-muted">
                      {fmtScore(imp.from)} → {fmtScore(imp.to)} <Delta value={imp.delta} className="ml-1" />
                    </span>
                  </div>
                  <div className="mt-1">
                    {imp.demonstrated ? (
                      <Tag className="border-good/40 text-good">
                        <CheckCircle2 size={11} aria-hidden /> Demonstrated
                      </Tag>
                    ) : (
                      <Tag>Claimed — activity only, no evidence in period</Tag>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-muted">
                    {imp.drivers.map((d) => (
                      <li key={d.title + d.component} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {d.source === "evidence" || d.source === "project" || d.source === "milestone" ? <FileCheck2 size={11} className="mr-1 inline text-good" aria-hidden /> : null}
                          {d.title}
                          {d.count > 1 ? <span className="text-faint"> ×{d.count}</span> : null}
                        </span>
                        <span className="tabular shrink-0 text-faint">+{d.contribution.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No skill improved meaningfully in this period.</p>
          )}
        </Section>

        <Section id="needs-work" title="What needs work" description="Low, stagnant, neglected and theory-heavy areas, and goals slipping.">
          {engine.weaknesses.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {engine.weaknesses.slice(0, 10).map((w) => (
                <li key={w.key} className="py-2.5">
                  <Link href={w.href ?? "#"} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-1.5 font-medium group-hover:text-accent-strong">
                        <AlertTriangle size={13} className={w.severity >= 70 ? "text-critical" : "text-warning"} aria-hidden />
                        {w.title}
                      </span>
                      {w.score != null ? <span className="tabular text-[12px] text-faint">{fmtScore(w.score)} / 100</span> : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">{w.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nothing is flagged right now.</p>
          )}
        </Section>
      </div>

      <Section title="Timeline" description="Milestones, achievements, completed projects and key evidence.">
        {months.size ? (
          <ol className="flex flex-col gap-6">
            {[...months.entries()].map(([month, events]) => (
              <li key={month}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-faint">{formatMonth(`${month}-01`)}</h3>
                <ol className="relative ml-1.5 border-l border-line">
                  {events.map((e) => (
                    <li key={e.key} className="relative pb-3 pl-5 last:pb-0">
                      <span className="absolute -left-[9px] top-0.5 flex h-[17px] w-[17px] items-center justify-center rounded-full border border-line bg-bg">
                        {e.kind === "achievement" ? <Award size={10} className="text-accent" /> : e.kind === "milestone" ? <Flag size={10} className="text-good" /> : e.kind === "project" ? <CheckCircle2 size={10} className="text-good" /> : <TrendingUp size={10} className="text-muted" />}
                      </span>
                      <p className="text-[13.5px]">
                        {e.href ? (
                          <Link href={e.href} className="hover:text-accent-strong">
                            {e.title}
                          </Link>
                        ) : (
                          e.title
                        )}
                        <span className="ml-2 text-[12px] text-faint">{formatDate(e.date)}</span>
                      </p>
                      {e.detail ? <p className="text-[12px] text-faint">{e.detail}</p> : null}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-muted">No milestones or achievements in this period.</p>
        )}
      </Section>

      <p className="text-[12px] text-faint">
        {snapshotDays.size
          ? `${snapshotDays.size} daily score snapshot${snapshotDays.size === 1 ? "" : "s"} recorded since ${formatDate(firstSnapshot!, { year: true })} (engine ${ENGINE_VERSION}). Snapshots are written whenever you change data and keep a permanent record even if the formula changes.`
          : `Score snapshots are recorded each day you change data (engine ${ENGINE_VERSION}).`}
      </p>
    </div>
  );
}
