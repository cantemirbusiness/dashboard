import { ExternalLink, FileCheck2 } from "lucide-react";
import type { Evidence } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { EVIDENCE_LABEL } from "@/lib/format";
import { EditEvidenceButton } from "@/components/forms/evidence-form";

/** Evidence records, newest first, with kind, score, date and (optionally) skills. */
export function EvidenceList({ items, skillName }: { items: Evidence[]; skillName?: Record<string, string> }) {
  const sorted = [...items].sort((x, y) => (x.occurredOn < y.occurredOn ? 1 : x.occurredOn > y.occurredOn ? -1 : 0));
  return (
    <ul className="divide-y divide-line border-y border-line">
      {sorted.map((e) => {
        const skills = skillName ? e.skillIds.map((id) => skillName[id]).filter(Boolean) : [];
        return (
          <li key={e.id} className="flex items-start gap-3 py-2.5">
            <FileCheck2 size={15} className="mt-0.5 shrink-0 text-good" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug">
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent-strong">
                    {e.title} <ExternalLink size={12} className="inline text-faint" aria-hidden />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  e.title
                )}
              </p>
              <p className="text-[12px] text-faint">
                {EVIDENCE_LABEL[e.kind]}
                {e.assessmentScore != null ? ` · score ${e.assessmentScore}` : ""} · {formatDate(e.occurredOn, { year: true })}
                {skills.length ? ` · ${skills.join(", ")}` : ""}
              </p>
            </div>
            <EditEvidenceButton evidence={e} />
          </li>
        );
      })}
    </ul>
  );
}
