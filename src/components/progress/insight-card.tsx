"use client";

import { ArrowRight, EyeOff, Pin, PinOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { Insight } from "@/lib/engine";
import { setInsightState } from "@/lib/actions/entities";
import { useAction } from "@/components/app/use-action";
import { useAppData } from "@/components/app/app-data";
import { cn } from "@/components/ui/cn";

const TONE = { positive: "bg-good", negative: "bg-critical", neutral: "bg-[var(--fg-faint)]" } as const;

export function InsightCard({ insight, state }: { insight: Insight; state?: "dismissed" | "pinned" }) {
  const { run, pending } = useAction(setInsightState);
  const { readOnly } = useAppData();
  return (
    <li className={cn("group flex gap-3 py-3", pending && "opacity-60")}>
      <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", TONE[insight.tone])} aria-label={insight.tone} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-snug">
          {state === "pinned" ? <Pin size={12} className="mr-1 inline text-accent" aria-label="Pinned" /> : null}
          {insight.title}
        </p>
        <p className="mt-0.5 text-[13px] text-muted">{insight.body}</p>
        {insight.href ? (
          <Link href={insight.href} className="mt-1 inline-flex items-center gap-1 text-[12px] text-faint hover:text-fg">
            Details <ArrowRight size={11} />
          </Link>
        ) : null}
      </div>
      {!readOnly ? (
        <div className="flex shrink-0 items-start gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {state === "dismissed" ? (
            <IconBtn label="Restore" onClick={() => run({ key: insight.key, state: null })}>
              <RotateCcw size={14} />
            </IconBtn>
          ) : (
            <>
              <IconBtn label={state === "pinned" ? "Unpin" : "Pin"} onClick={() => run({ key: insight.key, state: state === "pinned" ? null : "pinned" })}>
                {state === "pinned" ? <PinOff size={14} /> : <Pin size={14} />}
              </IconBtn>
              <IconBtn label="Dismiss" onClick={() => run({ key: insight.key, state: "dismissed" })}>
                <EyeOff size={14} />
              </IconBtn>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="rounded p-1.5 text-faint hover:bg-hover hover:text-fg">
      {children}
    </button>
  );
}
