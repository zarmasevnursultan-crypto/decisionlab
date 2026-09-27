-- Run as postgres after all migrations. Leaves no data behind.
begin;
insert into public.cases(id,title,briefing) values ('33333333-3333-4333-8333-333333333333','Progress test','Test');
insert into public.suspects(id,case_id,name,role,description) values ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Test','Test','Test');
update public.cases set culprit_id='44444444-4444-4444-8444-444444444444' where id='33333333-3333-4333-8333-333333333333';
insert into public.sessions(id,case_id,token_hash,player_hash) values ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','test-session-progress','test-player');
set constraints all immediate;
do $$
declare updated boolean;
begin
  updated := public.update_investigation_session('55555555-5555-4555-8555-555555555555',0,'{"caseTitle":"Test","totalEvidence":1,"studied":[],"hints":["test"],"attempts":[],"abandonedAt":null}',null,null);
  if not updated then raise exception 'First update failed'; end if;
  updated := public.update_investigation_session('55555555-5555-4555-8555-555555555555',0,'{"studied":[],"hints":[],"attempts":[]}',null,null);
  if updated then raise exception 'Stale revision accepted'; end if;
  if (select hints_used from public.sessions where id='55555555-5555-4555-8555-555555555555') <> 1 then raise exception 'Hint count lost'; end if;
  updated := public.update_investigation_session('55555555-5555-4555-8555-555555555555',1,'{"caseTitle":"Test","totalEvidence":1,"studied":[],"hints":["test"],"attempts":[{"suspectId":"44444444-4444-4444-8444-444444444444","correct":true,"score":90}],"abandonedAt":null}',now(),'{"suspectId":"44444444-4444-4444-8444-444444444444","correct":true,"score":90}');
  if not updated then raise exception 'Verdict failed'; end if;
  if not exists(select 1 from public.attempts where session_id='55555555-5555-4555-8555-555555555555' and correct and score=90) then raise exception 'Attempt missing'; end if;
end $$;
rollback;
