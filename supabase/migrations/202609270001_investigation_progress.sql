begin;
alter table public.sessions add column player_hash text;
alter table public.sessions add column state jsonb not null default '{"caseTitle":"","totalEvidence":0,"studied":[],"hints":[],"attempts":[],"abandonedAt":null}'::jsonb;
alter table public.sessions add column revision integer not null default 0 check (revision >= 0);
create index sessions_player_history_idx on public.sessions(player_hash, completed_at desc) where completed_at is not null;
-- Paid hints are server-only, including direct PostgREST access.
revoke select on public.evidence from anon, authenticated;
grant select (id, case_id, type, section, title, subtitle, danger, content, position) on public.evidence to anon, authenticated;

create function public.update_investigation_session(p_id uuid, p_revision integer, p_state jsonb, p_completed_at timestamptz, p_attempt jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_session public.sessions%rowtype;
begin
  select * into current_session from public.sessions where id = p_id for update;
  if not found or current_session.revision <> p_revision then return false; end if;
  if current_session.completed_at is not null then return false; end if;
  if jsonb_typeof(p_state -> 'studied') is distinct from 'array'
     or jsonb_typeof(p_state -> 'hints') is distinct from 'array'
     or jsonb_typeof(p_state -> 'attempts') is distinct from 'array' then raise exception 'Invalid session state'; end if;
  if p_attempt is not null and jsonb_typeof(p_attempt) = 'object' then
    insert into public.attempts(session_id, case_id, suspect_id, correct, score)
    values (p_id, current_session.case_id, (p_attempt ->> 'suspectId')::uuid, (p_attempt ->> 'correct')::boolean, (p_attempt ->> 'score')::integer);
  end if;
  update public.sessions set state = p_state, hints_used = jsonb_array_length(p_state -> 'hints'), completed_at = p_completed_at, revision = revision + 1 where id = p_id;
  return true;
end;
$$;
revoke all on function public.update_investigation_session(uuid, integer, jsonb, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.update_investigation_session(uuid, integer, jsonb, timestamptz, jsonb) to service_role;
commit;
