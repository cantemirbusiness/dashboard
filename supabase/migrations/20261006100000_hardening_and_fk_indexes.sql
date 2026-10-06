-- =============================================================================
-- Hardening + performance (from Supabase advisors)
--
-- 1. Trigger functions are SECURITY DEFINER; they must not be callable through
--    the API (/rest/v1/rpc/...). Triggers still fire normally: EXECUTE is not
--    checked for the role that fires a trigger.
-- 2. Covering indexes for the composite (x_id, user_id) foreign keys, so
--    cascades / set-null on delete don't scan whole tables.
-- =============================================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Supabase's own RLS auto-enable event trigger helper (present on new projects).
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Composite foreign-key indexes -------------------------------------------------
create index if not exists activities_project_fk_idx       on public.activities (project_id, user_id);

create index if not exists activity_skills_activity_fk_idx on public.activity_skills (activity_id, user_id);
create index if not exists activity_skills_skill_fk_idx    on public.activity_skills (skill_id, user_id);

create index if not exists evidence_activity_fk_idx        on public.evidence (activity_id, user_id);
create index if not exists evidence_milestone_fk_idx       on public.evidence (milestone_id, user_id);
create index if not exists evidence_project_fk_idx         on public.evidence (project_id, user_id);

create index if not exists evidence_skills_evidence_fk_idx on public.evidence_skills (evidence_id, user_id);
create index if not exists evidence_skills_skill_fk_idx    on public.evidence_skills (skill_id, user_id);

create index if not exists goal_projects_goal_fk_idx       on public.goal_projects (goal_id, user_id);
create index if not exists goal_projects_project_fk_idx    on public.goal_projects (project_id, user_id);

create index if not exists goal_skills_goal_fk_idx         on public.goal_skills (goal_id, user_id);
create index if not exists goal_skills_skill_fk_idx        on public.goal_skills (skill_id, user_id);

create index if not exists goals_category_fk_idx           on public.goals (category_id, user_id);

create index if not exists milestones_goal_fk_idx          on public.milestones (goal_id, user_id);
create index if not exists milestones_project_fk_idx       on public.milestones (project_id, user_id);
create index if not exists milestones_skill_fk_idx         on public.milestones (skill_id, user_id);

create index if not exists project_skills_project_fk_idx   on public.project_skills (project_id, user_id);
create index if not exists project_skills_skill_fk_idx     on public.project_skills (skill_id, user_id);

create index if not exists project_tracks_project_fk_idx   on public.project_tracks (project_id, user_id);
create index if not exists project_tracks_user_idx         on public.project_tracks (user_id);

create index if not exists skills_category_fk_idx          on public.skills (category_id, user_id);
