# Progress — personal progress dashboard

A personal operating system for development. It turns what you learn, practise, build and ship into an explainable picture of your progress:

**Knowledge → Practice → Projects → Results → Progress**

It answers: *Where am I? How much have I improved, and at what? What am I good and bad at? What have I neglected? Am I on track? What should I do next? Am I producing results or just consuming information?*

Hours logged don't count as progress by themselves. Scores come from a documented [Progress Engine](docs/PROGRESS_ENGINE.md) that weighs difficulty, completion, practical application, evidence, consistency, recency and goal relevance. It caps passive study, and every point traces back to a record.

## Features

| Page | What it shows |
|---|---|
| **Overview** | Overall score (0–100) with its 30-day change and trend; next best actions; the last 30 days' metrics; biggest improvement; what needs attention; knowledge vs execution; goals; consistency calendar; recent activity |
| **Evolution** | Overall, skill and dimension history (month / quarter / year / all); activity and output trends; start → current → target for every skill; what improved, with evidence; what needs work; a milestone timeline |
| **Skills** | Categories, scores with starting level and target, 30-day trend, status (Improving / Stable / Stagnating / Declining / Needs attention), and a per-skill breakdown of *why* it has its score, plus the evidence behind it |
| **Goals** | Short- and long-term goals measured by skill scores, milestones or any number you track. Status (On track / At risk / Behind / Completed) is calculated; trajectory and projection charts; milestone checklists |
| **Projects** | Real output, separate from learning: work streams (Planning, Backend, AI, Frontend, Deployment…), time invested, milestones, evidence, links, notes |
| **Activity** | A fast log with filters, weekly hours, the contribution calendar, and all your evidence |
| **Insights** | Deterministic insights (improvements, weaknesses, consistency, imbalance, goals, output) that you can pin or dismiss, plus the live scoring constants |

You can log an activity from anywhere: press **N** on desktop, or tap the **+** in the mobile tab bar. Pick skills, a duration preset and a type, then save. Last-used values are remembered on each device.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **Supabase**: Postgres, Auth (email + password, magic link), Row Level Security
- **zod** for server-side validation, **Vitest** for tests, **lucide** icons
- Hand-written SVG charts (no chart library), dark-first theme with light/system modes

## Getting started

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste [`supabase/migrations/20261006000000_initial_schema.sql`](supabase/migrations/20261006000000_initial_schema.sql) into **SQL Editor** and run it, or use the CLI: `npx supabase init` (creates `supabase/config.toml` and keeps the existing migrations), then `npx supabase link --project-ref <ref> && npx supabase db push`.
3. In **Authentication → URL Configuration**, set **Site URL** to your app URL (e.g. `http://localhost:3000`, later your Vercel URL) and add `<your-url>/auth/confirm` to **Redirect URLs**.
4. Copy the **Project URL** and the **publishable key** (or legacy anon key) from **Project Settings → API**.

### 2. Configure and run

```bash
git clone https://github.com/cantemirbusiness/personal-progress-dashboard.git
cd personal-progress-dashboard
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev                  # http://localhost:3000
```

Sign up, then pick **Load demo workspace** (seven months of realistic history) or **Start with my own data** (starter skill sets you can edit). You can remove the demo data at any time in **Settings → Your data**. Only rows flagged `is_demo` are deleted.

### Look around without a database

```bash
npm run preview   # PREVIEW_MODE=demo next dev — read-only, in-memory demo data
```

Preview mode only works under `next dev`. It is ignored in production builds.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works. Public by design: RLS protects the data |
| `NEXT_PUBLIC_SITE_URL` | production | Used in auth email links |

The **service-role key is never used** by this app. Don't add it.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel. The framework is detected automatically.
2. Add the three environment variables above.
3. Add `https://<your-domain>/auth/confirm` to Supabase **Redirect URLs** and set the **Site URL** to your domain.

Your data now lives in Supabase and is available from any device you sign in on.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run preview` | Development server with in-memory demo data (no Supabase) |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Progress Engine) |
| `npm run test:db` | Integration tests against a throwaway local Postgres + PostgREST: schema, RLS isolation, demo round-trip. Needs PostgreSQL 15+ binaries and `postgrest` on PATH |
| `npm run check` | typecheck + lint + test |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of the above on every push and pull request.

## Architecture

```
src/
  app/
    (app)/             Authenticated pages: overview, evolution, skills, goals, projects, activity, insights, settings
    (auth)/            Login and sign-up
    auth/confirm/      Email link handler (token-hash and PKCE code)
    welcome/           Onboarding (demo workspace or starter skills)
    api/export/        JSON export of your data
  components/
    app/               Shell, navigation, quick-add sheet, theme, client hooks
    charts/            Line, bar, sparkline, contribution calendar (SVG)
    forms/             Entity forms (skills, goals, milestones, projects, evidence, settings)
    progress/          Domain display components
    ui/                Primitives: buttons, fields, modal/sheet, toasts, status badges
  lib/
    engine/            Progress Engine: pure, deterministic, unit-tested
    data/              Workspace loader (RLS-scoped, paginated)
    actions/           Server Actions: auth → validate (zod) → write → revalidate → snapshot
    demo/              Demo workspace generator and seeding
    supabase/          Server client, session proxy, env
supabase/
  migrations/          Schema, constraints, RLS policies
  tests/               Supabase auth stub for local integration tests
docs/PROGRESS_ENGINE.md
```

**Data flow.** Every authenticated request loads the user's workspace once (`getWorkspace`, cached per request) and runs the engine once (`getEngine`). Pages are Server Components that read from that result. Mutations are Server Actions. Each one validates its input with zod, writes with the user's own Supabase session, revalidates, and then records the day's score snapshot in `after()`.

### Data model

`profiles` · `skill_categories` · `skills` · `projects` → `project_tracks`, `project_skills` · `goals` → `goal_skills`, `goal_projects` · `milestones` · `activities` → `activity_skills` · `evidence` → `evidence_skills` · `progress_snapshots` · `insights` (pin/dismiss state)

Many-to-many links use join tables, not JSON blobs. Every row carries `user_id`. Cross-table references are **composite foreign keys `(id, user_id)`**, so the database itself makes it impossible to link your record to another user's, even with a known UUID. Demo rows are flagged `is_demo`.

### Security

- Row Level Security on every table: owners only, scoped to the `authenticated` role, with `anon` revoked.
- Ownership-enforcing composite foreign keys, plus CHECK constraints on every enum, range and length.
- Server-side zod validation in every action. Errors are logged on the server and shown to the user as safe messages.
- Sessions are verified with `getClaims()` in the proxy and the data layer.
- No service-role key. URLs are restricted to http(s). Post-login redirects are restricted to same-site paths.
- Security headers: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.

## Seed / demo data vs real data

The demo workspace ([`src/lib/demo/generate.ts`](src/lib/demo/generate.ts)) tells a coherent story. You learned backend fundamentals and shipped a Task API. You're building an AI SaaS, study agents a lot but rarely build them, practise English steadily, and have barely touched deployment or sales. It is generated relative to today, so it never looks stale. Nothing on the dashboard is hard-coded: every number is computed from these rows by the same engine that scores your real data.
