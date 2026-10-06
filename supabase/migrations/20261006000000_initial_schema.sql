-- =============================================================================
-- Personal Progress Dashboard — initial schema
--
-- Design notes
-- * Every content table carries `user_id` (defaulting to auth.uid()) and is
--   protected by Row Level Security: a user can only ever see or touch rows
--   they own.
-- * Cross-table references use COMPOSITE foreign keys `(x_id, user_id)` that
--   point at a `unique (id, user_id)` on the parent. This makes it impossible
--   — at the database level — to link your activity to someone else's skill,
--   even if you somehow learned its UUID.
-- * `is_demo` marks rows created by the in-app demo workspace so they can be
--   removed in one action without touching real data.
-- * Enumerations are `text` + CHECK constraints so they are easy to evolve.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (char_length(display_name) <= 80),
  timezone           text not null default 'UTC' check (char_length(timezone) <= 64),
  weekly_hours_goal  numeric(5,1) not null default 10 check (weekly_hours_goal between 0 and 120),
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Skill categories & skills
-- -----------------------------------------------------------------------------
create table public.skill_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default 'slate' check (char_length(color) <= 20),
  sort_order  int  not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.skills (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id     uuid,
  name            text not null check (char_length(name) between 1 and 80),
  description     text check (char_length(description) <= 2000),
  -- Self-assessed level when tracking started. Growth is earned above this.
  baseline_score  numeric(5,2) not null default 10 check (baseline_score between 0 and 100),
  target_score    numeric(5,2) not null default 70 check (target_score between 0 and 100),
  tracked_since   date not null default current_date,
  archived        boolean not null default false,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name),
  foreign key (category_id, user_id)
    references public.skill_categories (id, user_id) on delete set null (category_id)
);
create index skills_user_idx on public.skills (user_id);

create trigger skills_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Projects (real output)
-- -----------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  description   text check (char_length(description) <= 4000),
  status        text not null default 'active'
                check (status in ('planning', 'active', 'paused', 'completed', 'abandoned')),
  -- Used only when the project has no tracks; otherwise progress = avg(tracks).
  manual_progress numeric(5,2) not null default 0 check (manual_progress between 0 and 100),
  start_date    date,
  target_date   date,
  completed_on  date,
  output        text check (char_length(output) <= 4000),
  notes         text check (char_length(notes) <= 8000),
  links         text[] not null default '{}' check (cardinality(links) <= 20),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  check (target_date is null or start_date is null or target_date >= start_date)
);
create index projects_user_idx on public.projects (user_id);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Work streams inside a project (Planning, Backend, AI, Frontend, Deployment…)
create table public.project_tracks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid not null,
  name        text not null check (char_length(name) between 1 and 60),
  progress    numeric(5,2) not null default 0 check (progress between 0 and 100),
  sort_order  int not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index project_tracks_project_idx on public.project_tracks (project_id);

create table public.project_skills (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid not null,
  skill_id    uuid not null,
  primary key (project_id, skill_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade,
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);
create index project_skills_user_idx on public.project_skills (user_id);

-- -----------------------------------------------------------------------------
-- Goals
-- -----------------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id   uuid,
  title         text not null check (char_length(title) between 1 and 160),
  description   text check (char_length(description) <= 4000),
  horizon       text not null default 'long' check (horizon in ('short', 'long')),
  -- How "current" is measured:
  --   skills     → average current score of the linked skills
  --   milestones → % of the goal's milestones achieved
  --   manual     → current_value entered by hand (e.g. € earned)
  measure       text not null default 'skills' check (measure in ('skills', 'milestones', 'manual')),
  unit          text check (char_length(unit) <= 20),
  start_value   numeric(12,2) not null default 0,
  current_value numeric(12,2) not null default 0,
  target_value  numeric(12,2) not null default 100,
  start_date    date not null default current_date,
  deadline      date,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  state         text not null default 'active' check (state in ('active', 'completed', 'abandoned')),
  completed_on  date,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  check (deadline is null or deadline >= start_date),
  foreign key (category_id, user_id)
    references public.skill_categories (id, user_id) on delete set null (category_id)
);
create index goals_user_idx on public.goals (user_id);

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_skills (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id   uuid not null,
  skill_id  uuid not null,
  primary key (goal_id, skill_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);
create index goal_skills_user_idx on public.goal_skills (user_id);

create table public.goal_projects (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid not null,
  project_id  uuid not null,
  primary key (goal_id, project_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index goal_projects_user_idx on public.goal_projects (user_id);

-- -----------------------------------------------------------------------------
-- Milestones & achievements
-- -----------------------------------------------------------------------------
create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 160),
  description   text check (char_length(description) <= 2000),
  goal_id       uuid,
  project_id    uuid,
  skill_id      uuid,
  due_on        date,
  achieved_on   date,
  -- 1 = minor, 2 = notable, 3 = major. Feeds the Progress Engine.
  significance  smallint not null default 2 check (significance between 1 and 3),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete set null (skill_id)
);
create index milestones_user_idx on public.milestones (user_id);

-- -----------------------------------------------------------------------------
-- Activities (what you actually did)
-- -----------------------------------------------------------------------------
create table public.activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_on       date not null default current_date,
  title             text not null check (char_length(title) between 1 and 160),
  description       text check (char_length(description) <= 4000),
  type              text not null default 'learning'
                    check (type in ('learning', 'coding', 'project', 'practice', 'research', 'english', 'business', 'other')),
  -- The kind of work, which drives how it is weighted:
  --   knowledge → consuming / studying     (lowest weight)
  --   practice  → exercises, drills, reps
  --   execution → building real things     (highest weight)
  mode              text not null default 'knowledge' check (mode in ('knowledge', 'practice', 'execution')),
  project_id        uuid,
  duration_minutes  int not null check (duration_minutes between 1 and 1440),
  difficulty        smallint not null default 3 check (difficulty between 1 and 5),
  outcome           text not null default 'partial' check (outcome in ('none', 'partial', 'completed', 'shipped')),
  notes             text check (char_length(notes) <= 4000),
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);
create index activities_user_date_idx on public.activities (user_id, occurred_on desc);

create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

create table public.activity_skills (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id  uuid not null,
  skill_id     uuid not null,
  primary key (activity_id, skill_id),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade,
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);
create index activity_skills_user_idx on public.activity_skills (user_id);
create index activity_skills_skill_idx on public.activity_skills (skill_id);

-- -----------------------------------------------------------------------------
-- Evidence (proof that supports a score)
-- -----------------------------------------------------------------------------
create table public.evidence (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 160),
  kind            text not null
                  check (kind in ('project', 'repository', 'deployment', 'course', 'assessment',
                                  'writeup', 'implementation', 'milestone', 'real_world')),
  url             text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  description     text check (char_length(description) <= 2000),
  -- For assessments: the result, 0–100. Scales the evidence weight.
  assessment_score numeric(5,2) check (assessment_score is null or assessment_score between 0 and 100),
  occurred_on     date not null default current_date,
  activity_id     uuid,
  project_id      uuid,
  milestone_id    uuid,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete set null (activity_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (milestone_id, user_id) references public.milestones (id, user_id) on delete set null (milestone_id)
);
create index evidence_user_idx on public.evidence (user_id, occurred_on desc);

create table public.evidence_skills (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  evidence_id  uuid not null,
  skill_id     uuid not null,
  primary key (evidence_id, skill_id),
  foreign key (evidence_id, user_id) references public.evidence (id, user_id) on delete cascade,
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);
create index evidence_skills_user_idx on public.evidence_skills (user_id);

-- -----------------------------------------------------------------------------
-- Progress snapshots — a durable record of computed scores over time.
-- One row per (user, day, key). key is 'overall', 'dim:<name>' or 'skill:<uuid>'.
-- engine_version lets you tell scores computed by different formula versions apart.
-- -----------------------------------------------------------------------------
create table public.progress_snapshots (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  snapshot_on     date not null,
  key             text not null check (char_length(key) <= 80),
  score           numeric(6,2) not null check (score between 0 and 100),
  engine_version  text not null,
  created_at      timestamptz not null default now(),
  unique (user_id, snapshot_on, key)
);
create index progress_snapshots_user_idx on public.progress_snapshots (user_id, snapshot_on);

-- -----------------------------------------------------------------------------
-- Insights — insights are computed deterministically from data on every view.
-- This table stores the user's reactions to them (dismissed / pinned), keyed
-- by the insight's stable key.
-- -----------------------------------------------------------------------------
create table public.insights (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  insight_key  text not null check (char_length(insight_key) <= 200),
  state        text not null check (state in ('dismissed', 'pinned')),
  created_at   timestamptz not null default now(),
  primary key (user_id, insight_key)
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.skill_categories    enable row level security;
alter table public.skills              enable row level security;
alter table public.projects            enable row level security;
alter table public.project_tracks      enable row level security;
alter table public.project_skills      enable row level security;
alter table public.goals               enable row level security;
alter table public.goal_skills         enable row level security;
alter table public.goal_projects       enable row level security;
alter table public.milestones          enable row level security;
alter table public.activities          enable row level security;
alter table public.activity_skills     enable row level security;
alter table public.evidence            enable row level security;
alter table public.evidence_skills     enable row level security;
alter table public.progress_snapshots  enable row level security;
alter table public.insights            enable row level security;

-- Profiles: own row only. Inserts happen through the signup trigger.
create policy "profiles: read own"   on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Every other table: full CRUD on rows you own.
do $$
declare
  t text;
begin
  foreach t in array array[
    'skill_categories', 'skills', 'projects', 'project_tracks', 'project_skills',
    'goals', 'goal_skills', 'goal_projects', 'milestones', 'activities',
    'activity_skills', 'evidence', 'evidence_skills', 'progress_snapshots', 'insights'
  ]
  loop
    execute format(
      'create policy "%1$s: owner select" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: owner insert" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: owner update" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s: owner delete" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- Anonymous users get nothing.
revoke all on all tables in schema public from anon;
