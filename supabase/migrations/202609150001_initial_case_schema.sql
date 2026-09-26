-- DecisionLab: university data-leak investigations.
begin;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  briefing text not null check (length(trim(briefing)) > 0),
  culprit_id uuid,
  created_at timestamptz not null default now()
);

create table public.suspects (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  role text not null,
  description text not null,
  unique (case_id, id)
);

-- The culprit must belong to this case. Deferred for atomic case creation.
alter table public.cases add constraint cases_culprit_same_case
  foreign key (id, culprit_id) references public.suspects(case_id, id)
  deferrable initially deferred;

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  type text not null check (type in ('log', 'metadata', 'network', 'testimony')),
  section text not null check (section in ('mail', 'logs', 'files', 'people')),
  title text not null,
  subtitle text not null,
  danger boolean not null default false,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  hint text not null,
  position integer not null check (position >= 0),
  unique (case_id, position)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  -- Store only a hash of the random HttpOnly session cookie.
  token_hash text not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  hints_used integer not null default 0 check (hints_used >= 0),
  completed_at timestamptz,
  unique (id, case_id),
  check (expires_at > started_at),
  check (completed_at is null or completed_at >= started_at)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  case_id uuid not null,
  suspect_id uuid not null,
  correct boolean not null,
  score integer not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  foreign key (session_id, case_id) references public.sessions(id, case_id) on delete cascade,
  foreign key (case_id, suspect_id) references public.suspects(case_id, id),
  unique (session_id, suspect_id)
);
create index evidence_case_id_idx on public.evidence(case_id);
create index sessions_case_id_idx on public.sessions(case_id);
create index attempts_case_id_idx on public.attempts(case_id);

alter table public.cases enable row level security;
alter table public.suspects enable row level security;
alter table public.evidence enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;

revoke all on public.cases, public.suspects, public.evidence, public.sessions, public.attempts from public, anon, authenticated;
-- RLS filters rows, NOT columns. Never grant table-wide SELECT on cases.
grant select (id, title, briefing, created_at) on public.cases to anon, authenticated;
grant select on public.suspects, public.evidence to anon, authenticated;
create policy cases_read on public.cases for select to anon, authenticated using (true);
create policy suspects_read on public.suspects for select to anon, authenticated using (true);
create policy evidence_read on public.evidence for select to anon, authenticated using (true);

create view public.public_cases with (security_invoker = true) as
  select id, title, briefing, created_at from public.cases;
revoke all on public.public_cases from public, anon, authenticated;
grant select on public.public_cases to anon, authenticated;
grant all on public.cases, public.suspects, public.evidence, public.sessions, public.attempts to service_role;
grant select on public.public_cases to service_role;

comment on table public.attempts is 'Server-only: exposing successful attempts reveals the culprit.';
comment on column public.cases.culprit_id is 'Server-only. Never return through a game API.';
commit;
