import { formatDate } from "@/lib/dates";
import { fmtMinutes } from "@/lib/format";

/**
 * Contribution calendar (weeks as columns, Mon–Sun rows). Sequential single
 * hue: intensity = minutes logged. Each cell has a text title for hover / SR.
 */
export function ContributionCalendar({ days, start }: { days: { date: string; minutes: number }[]; start: string }) {
  const weeks: { date: string; minutes: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const level = (m: number) => (m <= 0 ? 0 : m < 45 ? 1 : m < 120 ? 2 : m < 240 ? 3 : 4);
  const fill = ["var(--cal-0)", "color-mix(in oklab, var(--accent) 30%, var(--cal-0))", "color-mix(in oklab, var(--accent) 55%, var(--cal-0))", "color-mix(in oklab, var(--accent) 80%, var(--cal-0))", "var(--accent)"];
  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, maxWidth: weeks.length * 17 }}
        role="img"
        aria-label={`Activity calendar since ${formatDate(start, { year: true })}`}
      >
        {weeks.map((w, wi) => (
          <div key={wi} className="grid grid-rows-7 gap-[3px]">
            {w.map((d) => (
              <div
                key={d.date}
                className="aspect-square w-full max-w-[14px] rounded-[2px]"
                style={{ background: fill[level(d.minutes)] }}
                title={`${formatDate(d.date, { year: true })}: ${d.minutes ? fmtMinutes(d.minutes) : "no activity"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-faint" style={{ maxWidth: weeks.length * 17, justifyContent: "flex-end" }}>
        Less
        {fill.map((f, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: f }} />
        ))}
        More
      </div>
    </div>
  );
}
