import { AlertTriangle, ArrowDownRight, CheckCircle2, CircleDot, Clock, PauseCircle, TrendingUp, XCircle, Minus } from "lucide-react";
import type { GoalStatus, SkillStatus } from "@/lib/engine";
import type { ProjectStatus } from "@/lib/domain";
import { cn } from "./cn";

// Status is always icon + label + color — never color alone.

const SKILL: Record<SkillStatus, { label: string; color: string; Icon: typeof CircleDot }> = {
  improving: { label: "Improving", color: "text-good", Icon: TrendingUp },
  stable: { label: "Stable", color: "text-muted", Icon: Minus },
  stagnating: { label: "Stagnating", color: "text-warning", Icon: PauseCircle },
  declining: { label: "Declining", color: "text-serious", Icon: ArrowDownRight },
  needs_attention: { label: "Needs attention", color: "text-critical", Icon: AlertTriangle },
};

const GOAL: Record<GoalStatus, { label: string; color: string; Icon: typeof CircleDot }> = {
  on_track: { label: "On track", color: "text-good", Icon: CheckCircle2 },
  at_risk: { label: "At risk", color: "text-warning", Icon: Clock },
  behind: { label: "Behind", color: "text-critical", Icon: AlertTriangle },
  completed: { label: "Completed", color: "text-accent", Icon: CheckCircle2 },
  abandoned: { label: "Abandoned", color: "text-faint", Icon: XCircle },
};

const PROJECT: Record<ProjectStatus, { label: string; color: string; Icon: typeof CircleDot }> = {
  planning: { label: "Planning", color: "text-muted", Icon: CircleDot },
  active: { label: "Active", color: "text-good", Icon: CircleDot },
  paused: { label: "Paused", color: "text-warning", Icon: PauseCircle },
  completed: { label: "Completed", color: "text-accent", Icon: CheckCircle2 },
  abandoned: { label: "Abandoned", color: "text-faint", Icon: XCircle },
};

function Pill({ label, color, Icon, className }: { label: string; color: string; Icon: typeof CircleDot; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium", color, className)}>
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}

export const SkillStatusBadge = ({ status, className }: { status: SkillStatus; className?: string }) => (
  <Pill {...SKILL[status]} className={className} />
);
export const GoalStatusBadge = ({ status, className }: { status: GoalStatus; className?: string }) => (
  <Pill {...GOAL[status]} className={className} />
);
export const ProjectStatusBadge = ({ status, className }: { status: ProjectStatus; className?: string }) => (
  <Pill {...PROJECT[status]} className={className} />
);
export const skillStatusLabel = (s: SkillStatus) => SKILL[s].label;
