-- 008_work_notes.sql
-- Meeting / Approval Notes (teacher work layer — separate from student records)

create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null default current_date,
  note_type text not null
    check (note_type in (
      'faculty_meeting',
      'approval',
      'team_leader',
      'deputy_director',
      'instruction',
      'general'
    )),
  source text,
  title text,
  content text not null,
  is_important boolean not null default false,
  status text not null default 'open'
    check (status in ('open', 'done')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_notes_date_idx on public.work_notes (note_date desc);
create index if not exists work_notes_type_idx on public.work_notes (note_type);
create index if not exists work_notes_status_idx on public.work_notes (status);

create table if not exists public.work_note_students (
  id uuid primary key default gen_random_uuid(),
  work_note_id uuid not null references public.work_notes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (work_note_id, student_id)
);

create index if not exists work_note_students_student_idx
  on public.work_note_students (student_id);

create table if not exists public.work_note_classes (
  id uuid primary key default gen_random_uuid(),
  work_note_id uuid not null references public.work_notes (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (work_note_id, class_id)
);

create index if not exists work_note_classes_class_idx
  on public.work_note_classes (class_id);

create table if not exists public.work_followups (
  id uuid primary key default gen_random_uuid(),
  work_note_id uuid not null references public.work_notes (id) on delete cascade,
  due_date date,
  note text not null,
  status text not null default 'open'
    check (status in ('open', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_followups_note_idx on public.work_followups (work_note_id);
create index if not exists work_followups_status_idx on public.work_followups (status);
create index if not exists work_followups_due_idx on public.work_followups (due_date);

alter table public.work_notes enable row level security;
alter table public.work_note_students enable row level security;
alter table public.work_note_classes enable row level security;
alter table public.work_followups enable row level security;

create policy "authenticated_all_work_notes" on public.work_notes
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_work_note_students" on public.work_note_students
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_work_note_classes" on public.work_note_classes
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_work_followups" on public.work_followups
  for all to authenticated using (true) with check (true);
