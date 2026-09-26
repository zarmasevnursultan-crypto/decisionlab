-- Run as postgres after applying the migration. All test data is rolled back.
begin;
insert into public.cases(id, title, briefing) values ('11111111-1111-4111-8111-111111111111', 'Access test', 'Test');
insert into public.suspects(id, case_id, name, role, description) values
 ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Test', 'Test', 'Test');
update public.cases set culprit_id = '22222222-2222-4222-8222-222222222222' where id = '11111111-1111-4111-8111-111111111111';
set constraints all immediate;
set local role anon;
do $$
begin
  if not exists(select 1 from public.public_cases where id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'Public case is not readable';
  end if;
  if not exists(select 1 from public.suspects where id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'Suspect is not readable';
  end if;
  begin
    perform culprit_id from public.cases;
    raise exception 'SECURITY FAILURE: culprit readable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.sessions;
    raise exception 'SECURITY FAILURE: sessions readable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.attempts;
    raise exception 'SECURITY FAILURE: attempts readable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cases(title, briefing) values ('Unauthorized', 'Unauthorized');
    raise exception 'SECURITY FAILURE: client can insert cases';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  perform id, title from public.public_cases;
  begin
    perform culprit_id from public.cases;
    raise exception 'SECURITY FAILURE: authenticated can read culprit';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
