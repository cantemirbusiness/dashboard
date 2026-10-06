import Link from "next/link";
import { getEngine } from "@/lib/data/workspace";
import type { Insight, InsightCategory } from "@/lib/engine";
import {
  COMPONENT_SHARE,
  CONSISTENCY_FLOOR,
  DIFFICULTY_WEIGHT,
  ENGINE_VERSION,
  EVIDENCE_WEIGHT,
  HOURS_EXPONENT,
  MODE_WEIGHT,
  OUTCOME_WEIGHT,
  RECENCY_FLOOR,
  RECENCY_HALF_LIFE_DAYS,
  SATURATION,
  SESSION_HOURS_CAP,
} from "@/lib/engine/config";
import { COMPONENT_LABEL, EVIDENCE_LABEL, OUTCOME_LABEL } from "@/lib/format";
import { DimensionBars, imbalanceSentence } from "@/components/progress/dimension-bars";
import { InsightCard } from "@/components/progress/insight-card";
import { NextActions } from "@/components/progress/next-actions";
import { PageHeader, Panel, Section } from "@/components/ui/display";

export const metadata = { title: "Insights" };

const GROUPS: { key: InsightCategory; title: string }[] = [
  { key: "recommendation", title: "Recommendation" },
  { key: "improvement", title: "Improvements" },
  { key: "weakness", title: "Weaknesses" },
  { key: "goal", title: "Goals" },
  { key: "imbalance", title: "Balance" },
  { key: "output", title: "Output" },
  { key: "consistency", title: "Consistency" },
];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ dismissed?: string }> }) {
  const { dismissed: showDismissed } = await searchParams;
  const { ws, engine } = await getEngine();
  const a = engine.analysis;
  const states = new Map(ws.insightStates.map((s) => [s.key, s.state]));
  const visible = engine.insights.filter((i) => states.get(i.key) !== "dismissed");
  const dismissed = engine.insights.filter((i) => states.get(i.key) === "dismissed");
  const pinned = visible.filter((i) => states.get(i.key) === "pinned");
  const rest = visible.filter((i) => states.get(i.key) !== "pinned");
  const imbalance = imbalanceSentence(a.dimensions.current);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Insights" description="Deterministic observations computed from your data. Each one links to the records behind it." />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          {pinned.length ? <Group title="Pinned" items={pinned} states={states} /> : null}
          {GROUPS.map((g) => {
            const items = rest.filter((i) => i.category === g.key);
            return items.length ? <Group key={g.key} title={g.title} items={items} states={states} /> : null;
          })}
          {visible.length === 0 ? <p className="text-[13px] text-muted">No insights yet. They appear as you log activity, collect evidence and set goals.</p> : null}
          {dismissed.length ? (
            showDismissed ? (
              <Group title={`Dismissed (${dismissed.length})`} items={dismissed} states={states} />
            ) : (
              <Link href="/insights?dismissed=1" className="text-[12px] text-faint hover:text-fg">
                Show {dismissed.length} dismissed
              </Link>
            )
          ) : null}
        </div>

        <div className="flex flex-col gap-8">
          <Section title="Next best actions">
            <Panel className="p-4">
              <NextActions recs={engine.recommendations} />
            </Panel>
          </Section>
          <Section title="Knowledge vs execution">
            <DimensionBars current={a.dimensions.current} previous={a.dimensions.previous} />
            {imbalance ? <p className="mt-4 border-l-2 border-accent pl-3 text-[13px] text-muted">{imbalance}</p> : null}
          </Section>
        </div>
      </div>

      <Section id="engine" title="How scores work" description={`Progress Engine v${ENGINE_VERSION}. These are the live constants used for every number in the app.`}>
        <div className="grid gap-8 text-[13px] leading-relaxed text-muted lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <p>
              <span className="font-medium text-fg">Skill score</span> = starting level + earned growth. Growth is earned in five components, each with a ceiling, so no single kind of effort can max a skill out:
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="py-1 font-medium">Component</th>
                  <th className="py-1 text-right font-medium">Max share of headroom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(Object.keys(COMPONENT_SHARE) as (keyof typeof COMPONENT_SHARE)[]).map((c) => (
                  <tr key={c}>
                    <td className="py-1.5">{COMPONENT_LABEL[c]}</td>
                    <td className="tabular py-1.5 text-right">{Math.round(COMPONENT_SHARE[c] * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Each component fills with diminishing returns: <code className="rounded bg-panel-2 px-1">1 − e^(−points / k)</code>, with k ={" "}
              {Object.entries(SATURATION)
                .map(([c, k]) => `${k} (${c})`)
                .join(", ")}
              . Earned growth is multiplied by a consistency factor from {CONSISTENCY_FLOOR} (sporadic) to 1.0 (active every week of the last 12).
            </p>
            <p>
              Pure study can only ever earn {Math.round(COMPONENT_SHARE.knowledge * 100)}% of the distance to 100. Without evidence or real output a skill tops out at{" "}
              {Math.round((COMPONENT_SHARE.knowledge + COMPONENT_SHARE.practice + COMPONENT_SHARE.execution) * 100)}%.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <p>
              <span className="font-medium text-fg">Activity points</span> = hours<sup>{HOURS_EXPONENT}</sup> (max {SESSION_HOURS_CAP}h per session) × kind of work (knowledge {MODE_WEIGHT.knowledge}, practice{" "}
              {MODE_WEIGHT.practice}, execution {MODE_WEIGHT.execution}) × difficulty ({DIFFICULTY_WEIGHT[1]}–{DIFFICULTY_WEIGHT[5]}) × outcome (
              {Object.entries(OUTCOME_WEIGHT)
                .map(([o, w]) => `${OUTCOME_LABEL[o as keyof typeof OUTCOME_LABEL].toLowerCase()} ${w}`)
                .join(", ")}
              ), split evenly across the activity&apos;s skills.
            </p>
            <p>
              <span className="font-medium text-fg">Recency:</span> activity weight halves every {RECENCY_HALF_LIFE_DAYS} days down to a floor of {RECENCY_FLOOR}. Stop practising and the score drifts down
              slowly; it never erases what you did. Evidence does not decay.
            </p>
            <p>
              <span className="font-medium text-fg">Evidence weights:</span>{" "}
              {Object.entries(EVIDENCE_WEIGHT)
                .map(([k, v]) => `${EVIDENCE_LABEL[k as keyof typeof EVIDENCE_LABEL].toLowerCase()} ${v.weight}`)
                .join(", ")}
              . Completed projects add 3 output points to each linked skill (÷√n across n skills).
            </p>
            <p>
              <span className="font-medium text-fg">Overall progress</span> is the average of your skill scores; skills linked to active goals count up to 2× as much. Goal status compares progress with time
              elapsed and your 30-day pace.
            </p>
            <p>
              Full details and worked examples:{" "}
              <a className="text-accent hover:underline" href="https://github.com/cantemirbusiness/personal-progress-dashboard/blob/main/docs/PROGRESS_ENGINE.md" target="_blank" rel="noopener noreferrer">
                docs/PROGRESS_ENGINE.md
              </a>
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Group({ title, items, states }: { title: string; items: Insight[]; states: Map<string, "dismissed" | "pinned"> }) {
  return (
    <Section title={title}>
      <ul className="-my-3 divide-y divide-line">
        {items.map((i) => (
          <InsightCard key={i.key} insight={i} state={states.get(i.key)} />
        ))}
      </ul>
    </Section>
  );
}
