import Link from "next/link";
import type { SkillAnalysis } from "@/lib/engine";
import { relativeDay } from "@/lib/dates";
import { categoryColor, fmtScore } from "@/lib/format";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta, Meter } from "@/components/ui/display";
import { SkillStatusBadge } from "@/components/ui/status";

export function SkillRow({ s, today }: { s: SkillAnalysis; today: string }) {
  return (
    <Link
      href={`/skills/${s.skill.id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 hover:bg-hover/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_72px_76px_88px] sm:px-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{s.skill.name}</span>
          {s.confidence === "high" ? <span className="text-[11px] text-good" title={s.confidenceReason}>evidence-backed</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-faint">
          <SkillStatusBadge status={s.status} />
          <span>{s.lastActivityOn ? `last ${relativeDay(s.lastActivityOn, today)}` : "no activity"}</span>
        </div>
      </div>
      <div className="tabular text-right sm:hidden">
        <span className="text-[15px] font-semibold">{fmtScore(s.score)}</span>
        <Delta value={s.delta30} className="ml-1.5 text-[12px]" />
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Meter value={s.score} baseline={s.skill.baselineScore} target={s.skill.targetScore} color={categoryColor(s.category?.color)} label={`${s.skill.name} score`} />
        <span className="tabular hidden w-8 shrink-0 text-right text-[12px] text-faint sm:inline">{s.skill.targetScore}</span>
      </div>
      <span className="tabular hidden text-right text-[15px] font-semibold sm:block">{fmtScore(s.score)}</span>
      <span className="hidden justify-end text-[13px] sm:flex">
        <Delta value={s.delta30} />
      </span>
      <Sparkline values={s.sparkline} className="hidden justify-self-end sm:block" color={categoryColor(s.category?.color)} />
    </Link>
  );
}
