import type { Dimensions } from "@/lib/engine";
import { COMPONENT_HINT, COMPONENT_LABEL } from "@/lib/format";
import { Delta } from "@/components/ui/display";

const ORDER = ["knowledge", "practice", "execution", "demonstrated", "output"] as const;

/** Knowledge → Practice → Execution → Demonstrated → Output, each 0–100 with change vs 30 days ago. */
export function DimensionBars({ current, previous }: { current: Dimensions; previous?: Dimensions }) {
  return (
    <ul className="flex flex-col gap-3">
      {ORDER.map((k) => (
        <li key={k}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span title={COMPONENT_HINT[k]}>{COMPONENT_LABEL[k]}</span>
            <span className="flex items-baseline gap-2">
              <span className="tabular font-semibold">{Math.round(current[k])}</span>
              {previous ? <Delta value={current[k] - previous[k]} className="text-[12px]" precision={0} /> : null}
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-panel-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.min(100, current[k])}%` }} />
            {previous ? (
              <div
                className="absolute -top-0.5 h-2.5 w-px bg-fg/60"
                style={{ left: `${Math.min(100, previous[k])}%` }}
                title={`30 days ago: ${Math.round(previous[k])}`}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One deterministic sentence about the biggest imbalance between theory and output. */
export function imbalanceSentence(d: Dimensions): string | null {
  const theory = d.knowledge;
  const handsOn = (d.practice + d.execution) / 2;
  const proof = (d.demonstrated + d.output) / 2;
  if (theory - d.execution >= 15) return "Your theoretical knowledge is developing significantly faster than your practical execution.";
  if (d.execution - d.output >= 15) return "You're building a lot, but little of it has become visible output yet — ship, publish or deploy what you've built.";
  if (handsOn - proof >= 20) return "Plenty of practice; record evidence (repos, write-ups, assessments) so it counts as demonstrated skill.";
  if (proof >= handsOn && proof >= 20) return "Your progress is well backed by evidence and real output.";
  return null;
}
