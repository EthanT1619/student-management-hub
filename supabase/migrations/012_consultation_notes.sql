-- 012_consultation_notes.sql
-- Consultation preparation notes (talking points / outcome).
-- Independent from parent_contact records. No auto-linking either way.

create table if not exists public.consultation_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  consultation_date date not null default current_date,
  period_start date,
  period_end date,
  talking_points text,
  outcome text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultation_notes_student_idx
  on public.consultation_notes (student_id);

create index if not exists consultation_notes_date_idx
  on public.consultation_notes (consultation_date desc);

alter table public.consultation_notes enable row level security;

create policy "authenticated_all_consultation_notes" on public.consultation_notes
  for all to authenticated using (true) with check (true);
