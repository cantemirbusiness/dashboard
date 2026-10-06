import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Workspace } from "@/lib/domain";
import { QuickAddButton } from "@/components/app/quick-add";
import { cn } from "@/components/ui/cn";

interface Step {
  done: boolean;
  title: string;
  why: string;
  href?: string;
  quickAdd?: boolean;
}

/** Steps derived from the user's data; null once everything is set up. */
export function gettingStartedSteps(ws: Workspace): Step[] | null {
  if (ws.skills.some((s) => s.isDemo)) return null;
  const steps: Step[] = [
    {
      done: ws.skills.length > 0 && ws.skills.some((s) => s.baselineScore !== 10),
      title: "Set honest starting levels for your skills",
      why: "Growth is measured above where you start, so a realistic baseline keeps scores meaningful.",
      href: "/skills",
    },
    {
      done: ws.activities.length > 0,
      title: "Log what you worked on",
      why: "Every session feeds the skills it trained. Building counts more than studying.",
      quickAdd: true,
    },
    {
      done: ws.goals.length > 0,
      title: "Set a goal",
      why: "Goals decide what “on track” means and make linked skills count more.",
      href: "/goals",
    },
    {
      done: ws.projects.length > 0,
      title: "Track a real project",
      why: "Projects are your output. Completing one is the strongest signal in the scores.",
      href: "/projects",
    },
    {
      done: ws.evidence.length > 0,
      title: "Record evidence",
      why: "A repo, deploy or assessment turns claimed progress into demonstrated progress.",
      href: "/activity#evidence",
    },
  ];
  return steps.every((s) => s.done) ? null : steps;
}

export function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="getting-started" className="rounded-lg border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="getting-started" className="text-[15px] font-semibold">
          Get set up
        </h2>
        <span className="tabular text-[12px] text-faint">
          {done} of {steps.length} done
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        Scores come from what you actually do: activity, projects and evidence, measured against honest starting levels.
      </p>
      <ol className="mt-4 flex flex-col divide-y divide-line border-y border-line">
        {steps.map((s) => {
          const body = (
            <>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  s.done ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
                )}
                aria-hidden
              >
                {s.done ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className={cn("block text-[14px]", s.done ? "text-faint line-through" : "font-medium")}>
                  {s.title}
                  <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                </span>
                {!s.done ? <span className="block text-[12.5px] text-muted">{s.why}</span> : null}
              </span>
              {!s.done ? <ArrowRight size={14} className="mt-1 shrink-0 text-faint" aria-hidden /> : null}
            </>
          );
          const cls = "flex w-full items-start gap-3 py-2.5 hover:bg-hover/40 sm:px-1";
          return (
            <li key={s.title}>
              {s.done ? (
                <div className={cls}>{body}</div>
              ) : s.quickAdd ? (
                <QuickAddButton className={cls}>{body}</QuickAddButton>
              ) : (
                <Link href={s.href!} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
