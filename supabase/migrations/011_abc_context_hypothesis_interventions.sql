-- 011_abc_context_hypothesis_interventions.sql
-- Phase 3B: ABC Observation metadata, Context Tags, Hypothesis↔Intervention links
-- No pattern analysis, diagnosis, or automatic recommendations.

-- ---------------------------------------------------------------------------
-- ABC Observation (optional extension of observation records)
-- ---------------------------------------------------------------------------
create table if not exists public.abc_observations (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null unique references public.records (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  antecedent text,
  behavior text not null,
  consequence text,
  teacher_response text,
  student_response text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abc_observations_student_idx on public.abc_observations (student_id);
create index if not exists abc_observations_case_idx on public.abc_observations (case_id);

-- ---------------------------------------------------------------------------
-- Context Tags (situational context — separate from domain Tags)
-- ---------------------------------------------------------------------------
create table if not exists public.context_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.record_context_tags (
  record_id uuid not null references public.records (id) on delete cascade,
  context_tag_id uuid not null references public.context_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (record_id, context_tag_id)
);

create index if not exists record_context_tags_tag_idx
  on public.record_context_tags (context_tag_id);

insert into public.context_tags (code, label, sort_order) values
  ('individual_work', '개별 활동', 10),
  ('group_work', '그룹 활동', 20),
  ('test', '시험', 30),
  ('presentation', '발표', 40),
  ('homework_check', '숙제 확인', 50),
  ('transition', '활동 전환', 60),
  ('teacher_question', '교사 질문', 70),
  ('peer_interaction', '또래 상호작용', 80),
  ('difficult_task', '어려운 과제', 90),
  ('time_pressure', '시간 압박', 100),
  ('class_start', '수업 시작', 110),
  ('class_end', '수업 종료', 120),
  ('other', '기타', 130)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Hypothesis ↔ Intervention (N:M)
-- ---------------------------------------------------------------------------
create table if not exists public.hypothesis_interventions (
  hypothesis_id uuid not null references public.working_hypotheses (id) on delete cascade,
  intervention_id uuid not null references public.interventions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hypothesis_id, intervention_id)
);

create index if not exists hypothesis_interventions_intervention_idx
  on public.hypothesis_interventions (intervention_id);

-- RLS
alter table public.abc_observations enable row level security;
alter table public.context_tags enable row level security;
alter table public.record_context_tags enable row level security;
alter table public.hypothesis_interventions enable row level security;

create policy "authenticated_all_abc_observations" on public.abc_observations
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_context_tags" on public.context_tags
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_record_context_tags" on public.record_context_tags
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_hypothesis_interventions" on public.hypothesis_interventions
  for all to authenticated using (true) with check (true);
