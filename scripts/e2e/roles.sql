-- The roles and schema a real Supabase project provides before migrations run.
-- Local E2E only; NEVER run against a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password 'authenticator';
create role supabase_auth_admin login createrole password 'authadmin';
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;
alter role supabase_auth_admin set search_path = auth;
grant create on database postgres to supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
