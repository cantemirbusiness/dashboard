# Progress Engine

The Progress Engine turns dated records — activities, evidence, completed projects and milestones — into scores, statuses, insights and recommendations. It is **deterministic** (same data → same output), **explainable** (every point can be traced to a record) and **hard to game** (time alone can't make you an expert).

Code: [`src/lib/engine/`](../src/lib/engine). Every constant lives in [`config.ts`](../src/lib/engine/config.ts). The Insights page renders the live values under "How scores work".

> Bump `ENGINE_VERSION` in `config.ts` whenever a formula or constant changes. Stored snapshots record the version they were computed with.

## The pipeline

```
Knowledge → Practice → Execution → Demonstrated → Real-world output
 (study)     (reps)     (building)   (proof)        (things that exist)
```

Each activity is tagged with a **kind of work** (`mode`): `knowledge`, `practice` or `execution`. The activity *type* (Learning, Coding, Project, English…) only suggests a default mode, and you can override it. Evidence feeds the two remaining channels.

## 1. Activity points

```
points = hours^0.85 × mode × difficulty × outcome × recency ÷ (number of skills)
```

| Factor | Values | Why |
|---|---|---|
| hours | capped at 6h per session, raised to 0.85 | Long sessions count more, with diminishing returns. A logged "14h day" counts as 6h. |
| mode | knowledge 0.6 · practice 1.0 · execution 1.3 | Building beats consuming. |
| difficulty | 1→0.7, 2→0.85, 3→1.0, 4→1.15, 5→1.3 | Hard work counts more than easy work. |
| outcome | none 0.8 · progress 1.0 · completed 1.15 · shipped 1.35 | Finishing and shipping are rewarded. |
| recency | `0.5 + 0.5 × 0.5^(age / 120 days)` | Unused skills drift down slowly. Nothing is ever erased: old work keeps at least half its weight. |
| split | ÷ n skills | An hour is an hour. Split it across the skills it trained. |

**Example.** A 2-hour build at difficulty 4 that you complete earns `1.80 × 1.3 × 1.15 × 1.15 = 3.10` points. Five hours of easy passive study with no outcome earns `3.93 × 0.6 × 0.85 × 0.8 = 1.60`. The build is worth almost twice as much.

## 2. Evidence, projects and milestones

Evidence doesn't decay: a deployed app stays deployed. It is divided by **√n** across n linked skills, because one artifact genuinely demonstrates several skills, though not each one fully.

| Kind | Channel | Weight |
|---|---|---|
| Course / module | demonstrated | 1 |
| Written explanation | demonstrated | 1 |
| Implementation | demonstrated | 1.5 |
| Assessment | demonstrated | 2 × score/100 |
| Milestone (evidence) | demonstrated | 2 |
| Repository | output | 2 |
| Completed project (evidence) | output | 3 |
| Deployed app | output | 3 |
| Real-world result | output | 4 |

- A **project marked completed** adds 3 output points (÷√n) to each linked skill.
- An **achieved milestone** linked to a skill adds `significance` (1–3) demonstrated points. Milestones already backed by an evidence record are not counted twice.
- Evidence without skills inherits them from its activity, then from its project.

## 3. Skill score

```
score = baseline + (100 − baseline) × consistency × Σ share_c × (1 − e^(−points_c / k_c))
```

The **baseline** is your self-assessed level when you started tracking. It is the *claimed* part of the score. Everything above it is *earned* and traceable.

| Component c | share_c (max part of headroom) | k_c (points for ~63%) |
|---|---|---|
| Knowledge | 20% | 20 |
| Practice | 20% | 20 |
| Execution | 25% | 30 |
| Demonstrated | 15% | 5 |
| Real-world output | 20% | 6 |

Consequences, by design:

- **Studying alone tops out at baseline + 20% of the headroom.** Logging 1,000 hours of reading cannot make you an expert.
- **Without evidence or output a skill tops out at 65% of the headroom.** The last 35% must be demonstrated.
- **Diminishing returns.** Each component saturates, so a balanced profile beats maxing one component.
- **Consistency** multiplies earned growth by `0.85 + 0.15 × (active weeks / 12)`. The window is shortened for skills tracked for less than 12 weeks.

### Worked example

Backend, baseline 20. Over 12 weeks you log a 90-minute course session and a 2-hour build session every week, then publish one repository.

| Line | Points | Saturation | Adds |
|---|---|---|---|
| Starting level | | | 20.0 |
| Knowledge | 9.0 | 36% | +5.7 |
| Execution | 25.0 | 57% | +11.2 |
| Real-world output (repo) | 2.0 | 28% | +4.5 |
| Consistency 11/12 weeks | ×0.99 | | (applied above) |
| **Score** | | | **41.4** |

This table is exactly what the skill page shows under "Why this score". The "What built this score" list then attributes each component's points back to individual records: `record contribution = component contribution × record points / component points`. The record contributions add up to the earned score.

### Status

Rules are evaluated in this order. *Needs attention* overrides the rest.

| Status | Rule |
|---|---|
| Declining | 30-day change ≤ −1 |
| Improving | 30-day change ≥ +2 |
| Stagnating | otherwise, and no activity for 30+ days |
| Stable | otherwise |
| **Needs attention** | linked to an active goal **and** stagnating/declining; **or** score < 35, ≥ 30 below target, idle 14+ days; **or** theory-heavy and goal-linked |

**Theory-heavy:** knowledge saturation ≥ 0.3 while the average of execution and output saturation is below half of it.

**Confidence:** *high* = at least 2 pieces of evidence and ≥ 25% of the earned score from demonstrated/output; *medium* = some evidence; *low* = baseline + activity only. This is how the app separates **claimed** from **demonstrated** progress.

## 4. Overall progress & dimensions

- **Overall** = weighted mean of all active skill scores. A skill's weight is `1 + 0.5 × (active goals linking it, max 2)`, so goal-relevant skills count up to 2×.
- **Dimensions** (Knowledge, Practice, Execution, Demonstrated, Real-world output) = the same weighted mean of each component's saturation × 100. They show *where* your growth comes from.

## 5. History without fabrication

Because every input is dated, the engine recomputes any score **as of any past date**, using only records dated on or before that day (recency is computed relative to that day too). That is how the Evolution page draws charts. No values are interpolated or invented.

- Before a skill's "tracked since" date it counts at its baseline. Otherwise adding a new skill would appear as a fake drop in your overall history.
- If there are fewer than 14 days of history, the Evolution page says so and explains what to record.
- Each data change also stores a **snapshot** (`progress_snapshots`: overall, dimensions, every skill, engine version) as a permanent record.

## 6. Goals

| Measure | Current value |
|---|---|
| Skill scores | mean of the linked skills' scores (reconstructable over time) |
| Milestones | % of the goal's milestones achieved |
| Manual | a number you update (€ earned, users…) |

With a deadline: `progress = (current − start) / (target − start)` and `time = elapsed / total`.

- **Completed:** current ≥ target, or you marked it completed.
- **Behind:** the deadline has passed.
- **On track:** < 10% of the time has passed, **or** progress/time ≥ 0.9, **or** your last 30–60 days' pace projects to reach the target by the deadline.
- **At risk:** progress/time ≥ 0.65, or the projection reaches ≥ 80% of the way.
- **Behind:** otherwise.

Without a deadline, a goal is on track while it is still moving and at risk after 30 flat days.

## 7. Next best actions

Candidates are generated from the data, scored, de-duplicated by subject (skill/project/goal), and the top few are shown:

1. **A lagging work stream** (< 35%) in an active project whose other streams average ≥ 55%, especially when a matching skill is weak. This is how "Deploy your current project" is produced.
2. **A goal that is behind or at risk.** Work on its weakest linked skill: a real build if that skill is theory-heavy, otherwise a focused session.
3. **A project that is ≥ 70% done.** Finish it; completion is the highest-weighted output.
4. **Theory-heavy skills.** Apply them in a small build.
5. **Overdue milestones**, or ones due within 14 days.
6. **Goal-linked skills idle for 21+ days.**
7. **An output gap** at profile level. Turn work into evidence.

Each action carries an impact (high/medium/low), an effort estimate (from remaining project % × hours invested so far, where available) and a reason sentence that cites the numbers.

## 8. Insights

The insights are deterministic sentences, each backed by a computation: 30-day improvements and declines (with their biggest driver), practical-attention gaps between goal-linked skills, active days this week vs last week, knowledge-vs-execution trend changes between the last two 30-day windows, evidence counts, completed projects, goal status and the top recommendation. Insight keys include the month, so a dismissed insight comes back when the situation recurs in a new period.
