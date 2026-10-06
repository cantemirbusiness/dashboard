"use client";

import { FileCheck2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "@/lib/domain";
import { deleteActivity } from "@/lib/actions/entities";
import { formatDate, relativeDay } from "@/lib/dates";
import { MODE_LABEL, OUTCOME_LABEL, TYPE_LABEL, fmtMinutes } from "@/lib/format";
import { useAppData } from "@/components/app/app-data";
import { useQuickAdd } from "@/components/app/quick-add";
import { useAction } from "@/components/app/use-action";
import { cn } from "@/components/ui/cn";

const MODE_DOT = { knowledge: "var(--s-blue)", practice: "var(--s-aqua)", execution: "var(--s-orange)" } as const;

export function ActivityList({
  activities,
  evidenceIds,
  groupByDay = false,
  showActions = true,
}: {
  activities: Activity[];
  /** Activities that have evidence attached. */
  evidenceIds?: Set<string> | string[];
  groupByDay?: boolean;
  showActions?: boolean;
}) {
  const data = useAppData();
  const skillName = new Map(data.skills.map((s) => [s.id, s.name]));
  const projectName = new Map(data.projects.map((p) => [p.id, p.name]));
  const withEvidence = evidenceIds instanceof Set ? evidenceIds : new Set(evidenceIds ?? []);

  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of activities) {
    const last = groups[groups.length - 1];
    if (groupByDay && last && last.day === a.occurredOn) last.items.push(a);
    else groups.push({ day: a.occurredOn, items: [a] });
  }

  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <div key={g.day + g.items[0].id}>
          {groupByDay ? (
            <div className="sticky top-12 z-10 flex items-baseline justify-between bg-bg/95 py-2 text-[12px] backdrop-blur lg:top-0">
              <span className="font-medium text-muted">
                {formatDate(g.day, { year: true })} <span className="text-faint">· {relativeDay(g.day, data.today)}</span>
              </span>
              <span className="tabular text-faint">{fmtMinutes(g.items.reduce((s, a) => s + a.durationMinutes, 0))}</span>
            </div>
          ) : null}
          <ul className="divide-y divide-line border-y border-line">
            {g.items.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: MODE_DOT[a.mode] }} title={MODE_LABEL[a.mode]} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[14px] leading-snug">
                      {a.title}
                      {withEvidence.has(a.id) ? <FileCheck2 size={13} className="ml-1.5 inline text-good" aria-label="Has evidence" /> : null}
                    </p>
                    <span className="tabular shrink-0 text-[13px] text-muted">{fmtMinutes(a.durationMinutes)}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-faint">
                    {!groupByDay ? <span>{relativeDay(a.occurredOn, data.today)}</span> : null}
                    <span>{TYPE_LABEL[a.type]}</span>
                    <span>{MODE_LABEL[a.mode]}</span>
                    {a.outcome !== "partial" ? <span className={cn(a.outcome === "shipped" && "text-good", a.outcome === "completed" && "text-muted")}>{OUTCOME_LABEL[a.outcome]}</span> : null}
                    {a.skillIds.length ? <span className="text-muted">{a.skillIds.map((s) => skillName.get(s) ?? "—").join(", ")}</span> : null}
                    {a.projectId ? <span>↳ {projectName.get(a.projectId)}</span> : null}
                  </p>
                </div>
                {showActions ? <RowMenu activity={a} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RowMenu({ activity }: { activity: Activity }) {
  const open = useQuickAdd();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useAction(deleteActivity, { success: "Activity deleted" });
  const readOnly = useAppData().readOnly;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Close on Escape (returning focus to the trigger) or on a click outside.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        trigger.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menu]);

  if (readOnly) return null;
  return (
    <div ref={root} className="relative -mr-1.5 shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setMenu((m) => !m);
          setConfirm(false);
        }}
        className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
        aria-label={`Actions for ${activity.title}`}
        aria-expanded={menu}
      >
        <MoreHorizontal size={16} />
      </button>
      {menu ? (
        <div
          className="absolute right-0 top-8 z-20 w-40 rounded-md border border-line-strong bg-panel-2 p-1 text-[13px] shadow-[var(--shadow)]"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-hover"
            onClick={() => {
              setMenu(false);
              open({ activity });
            }}
          >
            <Pencil size={13} /> Edit
          </button>
          {confirm ? (
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 font-medium text-critical hover:bg-hover"
              onClick={async () => {
                if (await run({ id: activity.id })) setMenu(false);
              }}
            >
              <Trash2 size={13} /> {pending ? "Deleting…" : "Confirm delete"}
            </button>
          ) : (
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-critical hover:bg-hover" onClick={() => setConfirm(true)}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
