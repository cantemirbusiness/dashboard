import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import type { Recommendation } from "@/lib/engine";
import { cn } from "@/components/ui/cn";

const IMPACT = { high: "text-accent", medium: "text-muted", low: "text-faint" } as const;

export function NextActions({ recs, compact }: { recs: Recommendation[]; compact?: boolean }) {
  if (recs.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Nothing urgent. Recommendations appear when a goal slips, a skill goes stale, a project nears completion, or theory outpaces practice.
      </p>
    );
  }
  const [first, ...rest] = recs;
  return (
    <div className="flex flex-col">
      <ActionItem rec={first} primary />
      {!compact
        ? rest.map((r) => (
            <div key={r.key} className="border-t border-line">
              <ActionItem rec={r} />
            </div>
          ))
        : null}
    </div>
  );
}

function ActionItem({ rec, primary }: { rec: Recommendation; primary?: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("font-medium leading-snug", primary ? "text-[16px]" : "text-[14px]")}>{rec.title}</h3>
        {rec.href ? <ArrowRight size={15} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]">
        <div className="flex gap-1">
          <dt className="text-faint">Impact</dt>
          <dd className={cn("inline-flex items-center gap-0.5 font-medium capitalize", IMPACT[rec.impact])}>
            {rec.impact === "high" ? <Zap size={11} aria-hidden /> : null}
            {rec.impact}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-faint">Effort</dt>
          <dd className="text-muted">{rec.effort}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{rec.reason}</p>
    </>
  );
  const cls = cn("group block py-3", primary && "pt-0");
  return rec.href ? (
    <Link href={rec.href} className={cn(cls, "rounded-sm hover:[&_h3]:text-accent-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
