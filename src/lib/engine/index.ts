// Progress Engine entry point. See docs/PROGRESS_ENGINE.md.
import type { Workspace } from "@/lib/domain";
import { analyzeWorkspace, type Analysis } from "./analyze";
import {
  computeImprovements,
  computeInsights,
  computeMetrics,
  computeRecommendations,
  computeTimeline,
  computeWeaknesses,
  type Improvement,
  type Insight,
  type OverviewMetrics,
  type Recommendation,
  type TimelineEvent,
  type Weakness,
} from "./narratives";

export interface EngineResult {
  analysis: Analysis;
  metrics: OverviewMetrics;
  recommendations: Recommendation[];
  insights: Insight[];
  weaknesses: Weakness[];
  improvements30: Improvement[];
  timeline: TimelineEvent[];
}

export function runEngine(ws: Workspace): EngineResult {
  const analysis = analyzeWorkspace(ws);
  const recommendations = computeRecommendations(ws, analysis, 5);
  return {
    analysis,
    metrics: computeMetrics(ws, analysis),
    recommendations,
    insights: computeInsights(ws, analysis, recommendations),
    weaknesses: computeWeaknesses(analysis),
    improvements30: computeImprovements(analysis, 30),
    timeline: computeTimeline(ws, analysis.today),
  };
}

export * from "./analyze";
export * from "./narratives";
export { ENGINE_VERSION, COMPONENTS, COMPONENT_SHARE, type Component } from "./config";
export type { Contribution, SkillScore } from "./skills";
