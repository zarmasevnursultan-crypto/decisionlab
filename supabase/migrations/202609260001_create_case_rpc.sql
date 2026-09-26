-- Atomic case creation for the server-only generator.
create or replace function public.create_case_from_payload(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_case_id uuid;
  suspect_ids uuid[] := array[]::uuid[];
  suspect_item jsonb;
  evidence_item jsonb;
  suspect_id uuid;
  culprit_index integer;
  item_position integer := 0;
begin
  if jsonb_typeof(p_payload -> 'suspects') <> 'array'
     or jsonb_array_length(p_payload -> 'suspects') not between 2 and 3
     or jsonb_typeof(p_payload -> 'evidence') <> 'array'
     or jsonb_array_length(p_payload -> 'evidence') not between 6 and 8 then
    raise exception 'Invalid case payload';
  end if;

  if jsonb_typeof(p_payload -> 'culprit_index') <> 'number' then
    raise exception 'Invalid culprit index';
  end if;
  culprit_index := (p_payload ->> 'culprit_index')::integer;
  if culprit_index < 0 or culprit_index >= jsonb_array_length(p_payload -> 'suspects') then
    raise exception 'Culprit index out of bounds';
  end if;

  insert into public.cases (title, briefing)
  values (p_payload ->> 'title', p_payload ->> 'briefing')
  returning id into new_case_id;

  for suspect_item in select value from jsonb_array_elements(p_payload -> 'suspects') loop
    insert into public.suspects (case_id, name, role, description)
    values (new_case_id, suspect_item ->> 'name', suspect_item ->> 'role', suspect_item ->> 'description')
    returning id into suspect_id;
    suspect_ids := array_append(suspect_ids, suspect_id);
  end loop;

  update public.cases set culprit_id = suspect_ids[culprit_index + 1] where id = new_case_id;

  for evidence_item in select value from jsonb_array_elements(p_payload -> 'evidence') loop
    insert into public.evidence (case_id, type, section, title, subtitle, danger, content, hint, position)
    values (
      new_case_id,
      evidence_item ->> 'type',
      evidence_item ->> 'section',
      evidence_item ->> 'title',
      evidence_item ->> 'subtitle',
      (evidence_item ->> 'danger')::boolean,
      evidence_item -> 'content',
      evidence_item ->> 'hint',
      item_position
    );
    item_position := item_position + 1;
  end loop;

  return new_case_id;
end;
$$;

revoke all on function public.create_case_from_payload(jsonb) from public, anon, authenticated;
grant execute on function public.create_case_from_payload(jsonb) to service_role;
