-- 007_message_archive.sql
-- Message Archive / Communication Library (record & reuse — no sending)

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  message_date date not null default current_date,
  purpose text not null
    check (purpose in (
      'dream_tree',
      'general_notice',
      'homework',
      'test',
      'level_test',
      'information_session',
      'consultation',
      'individual_feedback',
      'praise',
      'management',
      'other'
    )),
  title text,
  content text not null,
  notes text,
  is_template boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messages_date_idx on public.messages (message_date desc);
create index if not exists messages_purpose_idx on public.messages (purpose);
create index if not exists messages_template_idx on public.messages (is_template);

create table if not exists public.message_targets (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  target_type text not null
    check (target_type in ('all', 'class', 'student')),
  class_id uuid references public.classes (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint message_targets_shape check (
    (target_type = 'all' and class_id is null and student_id is null)
    or (target_type = 'class' and class_id is not null and student_id is null)
    or (target_type = 'student' and student_id is not null and class_id is null)
  )
);

create index if not exists message_targets_message_idx
  on public.message_targets (message_id);
create index if not exists message_targets_class_idx
  on public.message_targets (class_id)
  where class_id is not null;
create index if not exists message_targets_student_idx
  on public.message_targets (student_id)
  where student_id is not null;

alter table public.messages enable row level security;
alter table public.message_targets enable row level security;

create policy "authenticated_all_messages" on public.messages
  for all to authenticated
  using (true)
  with check (true);

create policy "authenticated_all_message_targets" on public.message_targets
  for all to authenticated
  using (true)
  with check (true);
