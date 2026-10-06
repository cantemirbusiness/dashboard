import Link from "next/link";
import type { GoalAnalysis } from "@/lib/engine";
import { formatDate } from "@/lib/dates";
import { GoalStatusBadge } from "@/components/ui/status";
import { Meter } from "@/components/ui/display";

const STATUS_COLOR = {
  on_track: "var(--good)",
  at_risk: "var(--warning)",
  behind: "var(--critical)",
  completed: "var(--accent)",
  abandoned: "var(--fg-faint)",
} as const;

export function fmtGoalValue(g: GoalAnalysis, v: number) {
  if (g.goal.measure === "milestones") return `${Math.round(v)}%`;
  if (g.goal.measure === "manual") return `${g.goal.unit && g.goal.unit.length <= 2 ? g.goal.unit : ""}${Math.round(v).toLocaleString("en")}${g.goal.unit && g.goal.unit.length > 2 ? ` ${g.goal.unit}` : ""}`;
  return v.toFixed(1);
}

export function GoalRow({ g }: { g: GoalAnalysis }) {
  return (
    <Link href={`/goals#${g.goal.id}`} className="block rounded-md py-2.5 hover:bg-hover/40">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[14px] font-medium leading-snug">{g.goal.title}</span>
        <GoalStatusBadge status={g.status} className="mt-0.5" />
      </div>
      <Meter value={g.progress * 100} color={STATUS_COLOR[g.status]} className="mt-2" label={`${g.goal.title} progress`} />
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12px] text-faint">
        <span className="tabular">
          {fmtGoalValue(g, g.current)} / {fmtGoalValue(g, g.target)}
        </span>
        <span>{g.goal.deadline ? `Due ${formatDate(g.goal.deadline, { year: true })}` : "No deadline"}</span>
      </div>
    </Link>
  );
}
