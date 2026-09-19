-- FINAL V3 SECURITY + REALTIME
-- The browser never receives a Supabase secret/publishable key for business data.
-- All business access goes through the backend with its own application JWT.
-- RLS is enabled with no anon/authenticated policies; service_role remains server-only.

begin;

alter table public.regional_offices enable row level security;
alter table public.regional_settings enable row level security;
alter table public.local_bureaus enable row level security;
alter table public.users enable row level security;
alter table public.user_sessions enable row level security;
alter table public.participation_counters enable row level security;
alter table public.participation_events enable row level security;
alter table public.observer_presence enable row level security;
alter table public.party_results enable row level security;
alter table public.result_corrections enable row level security;
alter table public.audit_logs enable row level security;

-- No browser role may access business tables directly.
revoke all on public.regional_offices from anon, authenticated;
revoke all on public.regional_settings from anon, authenticated;
revoke all on public.local_bureaus from anon, authenticated;
revoke all on public.users from anon, authenticated;
revoke all on public.user_sessions from anon, authenticated;
revoke all on public.participation_counters from anon, authenticated;
revoke all on public.participation_events from anon, authenticated;
revoke all on public.observer_presence from anon, authenticated;
revoke all on public.party_results from anon, authenticated;
revoke all on public.result_corrections from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

revoke all on function public.confirm_participation_delta(uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.heartbeat_observer(uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_party_result(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.request_result_correction(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.resolve_result_correction(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_election_mode(uuid, public.election_mode) from public, anon, authenticated;

grant all on public.regional_offices to service_role;
grant all on public.regional_settings to service_role;
grant all on public.local_bureaus to service_role;
grant all on public.users to service_role;
grant all on public.user_sessions to service_role;
grant all on public.participation_counters to service_role;
grant all on public.participation_events to service_role;
grant all on public.observer_presence to service_role;
grant all on public.party_results to service_role;
grant all on public.result_corrections to service_role;
grant all on public.audit_logs to service_role;

grant execute on function public.confirm_participation_delta(uuid, integer, uuid, text) to service_role;
grant execute on function public.heartbeat_observer(uuid, text) to service_role;
grant execute on function public.confirm_party_result(uuid, integer, uuid) to service_role;
grant execute on function public.request_result_correction(uuid, uuid, integer, text) to service_role;
grant execute on function public.resolve_result_correction(uuid, uuid, boolean) to service_role;
grant execute on function public.set_election_mode(uuid, public.election_mode) to service_role;

-- Realtime is consumed only by the backend service-role client, then re-broadcast
-- as authorization-neutral refresh notifications over the backend WebSocket.
alter table public.local_bureaus replica identity full;
alter table public.users replica identity full;
alter table public.participation_counters replica identity full;
alter table public.observer_presence replica identity full;
alter table public.party_results replica identity full;
alter table public.result_corrections replica identity full;
alter table public.regional_settings replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='local_bureaus') then
    alter publication supabase_realtime add table public.local_bureaus;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='users') then
    alter publication supabase_realtime add table public.users;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='participation_counters') then
    alter publication supabase_realtime add table public.participation_counters;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='observer_presence') then
    alter publication supabase_realtime add table public.observer_presence;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='party_results') then
    alter publication supabase_realtime add table public.party_results;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='result_corrections') then
    alter publication supabase_realtime add table public.result_corrections;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='regional_settings') then
    alter publication supabase_realtime add table public.regional_settings;
  end if;
end $$;

commit;
