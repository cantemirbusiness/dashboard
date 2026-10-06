import { Sparkles } from "lucide-react";
import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import type { SkillAnalysis } from "@/lib/engine";
import { categoryColor, fmtScore } from "@/lib/format";
import { AddSkillButton, CategoryManager } from "@/components/forms/skill-forms";
import { SkillRow } from "@/components/progress/skill-row";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Skills" };

const FILTERS: { key: string; label: string; match: (s: SkillAnalysis) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "improving", label: "Improving", match: (s) => s.status === "improving" },
  { key: "needs_attention", label: "Needs attention", match: (s) => s.status === "needs_attention" },
  { key: "stagnating", label: "Stagnating", match: (s) => s.status === "stagnating" || s.status === "declining" },
  { key: "theory", label: "Theory-heavy", match: (s) => s.theoryHeavy },
];

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const shown = a.skills.filter(filter.match);

  const groups = [
    ...a.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, skills: shown.filter((s) => s.skill.categoryId === c.id) })),
    { id: "none", name: "Uncategorised", color: "slate" as const, skills: shown.filter((s) => !s.skill.categoryId) },
  ].filter((g) => g.skills.length > 0);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, a.skills.filter(f.match).length]));
  const archived = ws.skills.filter((s) => s.archived);

  return (
    <div>
      <PageHeader
        title="Skills"
        description="Scores combine your starting level with logged activity, evidence and output. Open a skill to see exactly why it has its score."
        actions={
          <>
            <CategoryManager />
            <AddSkillButton />
          </>
        }
      />

      {a.skills.length === 0 ? (
        <EmptyState icon={<Sparkles size={22} />} title="No skills yet" action={<AddSkillButton />}>
          Add the skills you want to grow. Group them into categories like AI Engineering, Backend or Communication.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Filter skills" className="scrollbar-none -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/skills" : `/skills?status=${f.key}`}
                aria-current={filter.key === f.key ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[13px]",
                  filter.key === f.key ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:text-fg",
                )}
              >
                {f.label} <span className="tabular text-faint">{counts[f.key]}</span>
              </Link>
            ))}
          </nav>

          {groups.length === 0 ? <p className="text-[13px] text-muted">No skills match this filter.</p> : null}

          <div className="flex flex-col gap-8">
            {groups.map((g) => {
              const avg = g.skills.reduce((s, x) => s + x.score, 0) / g.skills.length;
              return (
                <section key={g.id} aria-labelledby={`cat-${g.id}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-line pb-2">
                    <h2 id={`cat-${g.id}`} className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(g.color) }} aria-hidden />
                      {g.name}
                    </h2>
                    <span className="tabular text-[12px] text-faint">avg {fmtScore(avg)}</span>
                  </div>
                  <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_72px_76px_88px] gap-x-4 px-2 py-1.5 text-[11px] uppercase tracking-wide text-faint sm:grid">
                    <span>Skill</span>
                    <span>Start → current · target</span>
                    <span className="text-right">Score</span>
                    <span className="text-right">30 days</span>
                    <span className="text-right">12 weeks</span>
                  </div>
                  <div className="divide-y divide-line">
                    {g.skills.map((s) => (
                      <SkillRow key={s.skill.id} s={s} today={a.today} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          {archived.length ? (
            <p className="mt-8 text-[12px] text-faint">
              Archived:{" "}
              {archived.map((s, i) => (
                <span key={s.id}>
                  {i ? ", " : ""}
                  <Link href={`/skills/${s.id}`} className="underline underline-offset-2 hover:text-fg">
                    {s.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
