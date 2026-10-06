// =============================================================================
// Progress Engine — tunable constants
//
// Every number that influences a score lives here, with the reason it exists.
// See docs/PROGRESS_ENGINE.md for the full model and worked examples.
// Bump ENGINE_VERSION whenever a constant or formula changes so stored
// snapshots can be told apart.
// =============================================================================

import type { ActivityMode, EvidenceKind, Outcome } from "@/lib/domain";

export const ENGINE_VERSION = "1.0.0";

// ---- Activity points ---------------------------------------------------------
// points = hoursFactor × mode × difficulty × outcome × recency × skillSplit

/** A single session counts at most this many hours (blocks "logged 14h" gaming). */
export const SESSION_HOURS_CAP = 6;

/**
 * Hours are raised to this power: 1h → 1.0, 2h → 1.8, 4h → 3.2, 6h → 4.6.
 * Long sessions still count more, but with diminishing returns.
 */
export const HOURS_EXPONENT = 0.85;

/** Building beats practising beats consuming. */
export const MODE_WEIGHT: Record<ActivityMode, number> = {
  knowledge: 0.6,
  practice: 1.0,
  execution: 1.3,
};

/** Difficulty 1–5 → 0.7 … 1.3. Hard work counts more than easy work. */
export const DIFFICULTY_WEIGHT: Record<number, number> = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 1.15,
  5: 1.3,
};

/** What came out of the session. Finishing and shipping are rewarded. */
export const OUTCOME_WEIGHT: Record<Outcome, number> = {
  none: 0.8,
  partial: 1.0,
  completed: 1.15,
  shipped: 1.35,
};

/**
 * Recency: an activity's weight decays from 1.0 towards RECENCY_FLOOR with this
 * half-life. Skills you stop using drift down slowly; nothing is ever erased.
 */
export const RECENCY_HALF_LIFE_DAYS = 120;
export const RECENCY_FLOOR = 0.5;

// ---- Evidence ----------------------------------------------------------------
// Evidence feeds two channels:
//   demonstrated → proof you can do it (assessments, implementations, write-ups)
//   output       → real things that exist in the world (repos, deployments, results)
// Evidence does NOT decay: a deployed app stays deployed.

export type EvidenceChannel = "demonstrated" | "output";

export const EVIDENCE_WEIGHT: Record<EvidenceKind, { channel: EvidenceChannel; weight: number }> = {
  course: { channel: "demonstrated", weight: 1 },
  writeup: { channel: "demonstrated", weight: 1 },
  implementation: { channel: "demonstrated", weight: 1.5 },
  assessment: { channel: "demonstrated", weight: 2 }, // × score/100 when a score is given
  milestone: { channel: "demonstrated", weight: 2 },
  repository: { channel: "output", weight: 2 },
  project: { channel: "output", weight: 3 },
  deployment: { channel: "output", weight: 3 },
  real_world: { channel: "output", weight: 4 },
};

/** A completed project counts as output for every skill it is linked to. */
export const COMPLETED_PROJECT_WEIGHT = 3;

/** An achieved milestone linked to a skill: significance (1–3) × this. */
export const MILESTONE_WEIGHT_PER_SIGNIFICANCE = 1;

// ---- Skill score -------------------------------------------------------------
// score = baseline + (100 − baseline) × consistency × Σ share_c × saturation_c
// saturation_c = 1 − e^(−points_c / SATURATION_c)

export const COMPONENTS = ["knowledge", "practice", "execution", "demonstrated", "output"] as const;
export type Component = (typeof COMPONENTS)[number];

/**
 * Maximum share of the headroom each component can ever earn. Pure studying
 * tops out at 20% of the distance to 100 — you cannot read your way to expert.
 * Without any evidence or output the ceiling is 65%.
 */
export const COMPONENT_SHARE: Record<Component, number> = {
  knowledge: 0.2,
  practice: 0.2,
  execution: 0.25,
  demonstrated: 0.15,
  output: 0.2,
};

/**
 * Points needed to reach ~63% of a component (1 − 1/e). Roughly: 20 points of
 * knowledge ≈ 35 hours of normal study; 30 points of execution ≈ 25 hours of
 * normal building; 6 points of output ≈ two completed projects.
 */
export const SATURATION: Record<Component, number> = {
  knowledge: 20,
  practice: 20,
  execution: 30,
  demonstrated: 5,
  output: 6,
};

/** Consistency looks at this many weeks before the scoring date. */
export const CONSISTENCY_WINDOW_WEEKS = 12;
/** Earned growth is multiplied by FLOOR + (1 − FLOOR) × activeWeekShare. */
export const CONSISTENCY_FLOOR = 0.85;

// ---- Overall score -----------------------------------------------------------
/** Each active goal that links a skill adds this much weight (max 2 goals). */
export const GOAL_RELEVANCE_BONUS = 0.5;
export const GOAL_RELEVANCE_MAX_GOALS = 2;

// ---- Status thresholds -------------------------------------------------------
export const STATUS = {
  improvingDelta30: 2,
  decliningDelta30: -1,
  stagnantAfterDays: 30,
  neglectedAfterDays: 21,
  lowScore: 35,
  largeGap: 30,
  /** "Theory heavy": knowledge saturation ≥ this … */
  theoryKnowledgeMin: 0.3,
  /** … while hands-on saturation is below this fraction of it. */
  theoryHandsOnRatio: 0.5,
} as const;

/** Evolution charts need at least this many days of history to be meaningful. */
export const MIN_HISTORY_DAYS = 14;
