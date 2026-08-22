-- 009_cases.sql
-- Case Tracking: long-running student management issues linking existing records

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  case_type text
    check (
      case_type is null
      or case_type in (
        'learning',
        'homework',
        'vocabulary',
        'class_participation',
        'behavior',
        'emotional',
        'parent_communication',
        'attendance',
        'other'
      )
    ),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  summary text,
  goal text,
  opened_at date not null default current_date,
  closed_at date,
  outcome text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_student_idx on public.cases (student_id);
create index if not exists cases_status_idx on public.cases (status);
create index if not exists cases_priority_idx on public.cases (priority);
create index if not exists cases_opened_idx on public.cases (opened_at desc);

create table if not exists public.case_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (case_id, record_id)
);

create index if not exists case_records_record_idx on public.case_records (record_id);

alter table public.cases enable row level security;
alter table public.case_records enable row level security;

create policy "authenticated_all_cases" on public.cases
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_case_records" on public.case_records
  for all to authenticated using (true) with check (true);
