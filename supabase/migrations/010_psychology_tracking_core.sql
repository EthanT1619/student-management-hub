-- 010_psychology_tracking_core.sql
-- Psychology-informed tracking: Observation / Student Voice / Hypothesis / Intervention / Response
-- No diagnosis, risk scores, or automated clinical recommendations.

-- ---------------------------------------------------------------------------
-- Student Voice (self-report facts, not interpretation)
-- ---------------------------------------------------------------------------
create table if not exists public.student_voice_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_id uuid references public.records (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  content text not null,
  recorded_at date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_voice_student_idx on public.student_voice_entries (student_id);
create index if not exists student_voice_record_idx on public.student_voice_entries (record_id);
create index if not exists student_voice_case_idx on public.student_voice_entries (case_id);

-- ---------------------------------------------------------------------------
-- Working Hypotheses (teacher interpretation — not established fact)
-- ---------------------------------------------------------------------------
create table if not exists public.working_hypotheses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  hypothesis text not null,
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  status text not null default 'active'
    check (status in ('active', 'supported', 'unsupported', 'closed')),
  needs_more_observation boolean not null default true,
  status_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists working_hypotheses_student_idx on public.working_hypotheses (student_id);
create index if not exists working_hypotheses_case_idx on public.working_hypotheses (case_id);
create index if not exists working_hypotheses_status_idx on public.working_hypotheses (status);

create table if not exists public.hypothesis_records (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references public.working_hypotheses (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (hypothesis_id, record_id)
);

create index if not exists hypothesis_records_record_idx on public.hypothesis_records (record_id);

-- ---------------------------------------------------------------------------
-- Interventions + Responses
-- ---------------------------------------------------------------------------
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_id uuid references public.records (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  intervention_type text not null
    check (intervention_type in (
      'prompting',
      'modeling',
      'scaffolding',
      'positive_reinforcement',
      'choice',
      'goal_setting',
      'study_strategy',
      'environmental_change',
      'retrieval_practice',
      'direct_instruction',
      'emotional_support',
      'other'
    )),
  description text not null,
  target text,
  applied_at date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interventions_student_idx on public.interventions (student_id);
create index if not exists interventions_record_idx on public.interventions (record_id);
create index if not exists interventions_case_idx on public.interventions (case_id);

create table if not exists public.intervention_responses (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions (id) on delete cascade,
  response_date date not null default current_date,
  response text not null,
  response_type text
    check (
      response_type is null
      or response_type in ('positive', 'neutral', 'negative', 'mixed', 'unclear')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intervention_responses_intervention_idx
  on public.intervention_responses (intervention_id);

-- RLS
alter table public.student_voice_entries enable row level security;
alter table public.working_hypotheses enable row level security;
alter table public.hypothesis_records enable row level security;
alter table public.interventions enable row level security;
alter table public.intervention_responses enable row level security;

create policy "authenticated_all_student_voice" on public.student_voice_entries
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_working_hypotheses" on public.working_hypotheses
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_hypothesis_records" on public.hypothesis_records
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_interventions" on public.interventions
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_intervention_responses" on public.intervention_responses
  for all to authenticated using (true) with check (true);
