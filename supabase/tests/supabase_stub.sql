-- Minimal stand-in for the parts of Supabase the migrations rely on, so the
-- schema and RLS can be tested against a plain Postgres + PostgREST.
-- NEVER run this against a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role authenticator login noinherit password 'authenticator';
grant anon, authenticated to authenticator;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;

-- Supabase's default grants (RLS does the real access control).
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
