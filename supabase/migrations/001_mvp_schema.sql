-- Student Management Hub — Phase 1 MVP Schema
-- Apply in Supabase SQL Editor or via CLI.

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'instructor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- students (no is_active — enrollment_status only)
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  korean_name text not null,
  english_name text,
  class_id uuid references public.classes (id) on delete set null,
  level text,
  class_days text[],
  period text,
  enrollment_status text not null default 'active'
    check (enrollment_status in ('active', 'inactive', 'withdrawn')),
  parent_management_status text not null default 'unclassified'
    check (parent_management_status in (
      'unclassified', 'stable', 'intensive_care',
      'retention_risk', 'temporary_leave', 'withdrawn'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null
    check (category in ('academic', 'learning_management', 'classroom_state')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- current_focus_items (Focus ≠ Tag; optional tag_id only)
-- ---------------------------------------------------------------------------
create table public.current_focus_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  note text,
  tag_id uuid references public.tags (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'done')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- records (stamp reason = content; no stamp_reason column)
-- ---------------------------------------------------------------------------
create table public.records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null default (current_date),
  record_type text not null
    check (record_type in (
      'observation', 'guidance', 'parent_contact',
      'positive_note', 'stamp', 'general_note'
    )),
  content text not null,
  is_important boolean not null default false,
  contact_method text
    check (contact_method is null or contact_method in ('phone', 'message', 'in_person', 'other')),
  stamp_amount integer,
  stamp_status text
    check (stamp_status is null or stamp_status in ('pending', 'given')),
  stamp_given_at date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint records_stamp_fields_check check (
    (
      record_type = 'stamp'
      and stamp_amount is not null
      and stamp_amount > 0
      and stamp_status is not null
    )
    or (
      record_type <> 'stamp'
      and stamp_amount is null
      and stamp_status is null
      and stamp_given_at is null
    )
  )
);

-- ---------------------------------------------------------------------------
-- record_tags
-- ---------------------------------------------------------------------------
create table public.record_tags (
  record_id uuid not null references public.records (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (record_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- followups (record 1 : N)
-- ---------------------------------------------------------------------------
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  due_date date,
  note text not null,
  status text not null default 'open'
    check (status in ('open', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- parent_status_history
-- ---------------------------------------------------------------------------
create table public.parent_status_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null
    check (status in (
      'unclassified', 'stable', 'intensive_care',
      'retention_risk', 'temporary_leave', 'withdrawn'
    )),
  changed_at timestamptz not null default now(),
  reason text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_students_class_id on public.students (class_id);
create index idx_students_parent_status on public.students (parent_management_status);
create index idx_students_enrollment on public.students (enrollment_status);
create index idx_focus_student_status on public.current_focus_items (student_id, status, sort_order);
create index idx_records_student_date on public.records (student_id, record_date desc);
create index idx_records_date on public.records (record_date desc);
create index idx_records_type on public.records (record_type);
create index idx_records_stamp_pending
  on public.records (stamp_status)
  where record_type = 'stamp' and stamp_status = 'pending';
create index idx_records_important
  on public.records (student_id)
  where is_important = true;
create index idx_record_tags_tag on public.record_tags (tag_id);
create index idx_followups_status_due on public.followups (status, due_date);
create index idx_followups_record on public.followups (record_id);
create index idx_parent_history_student on public.parent_status_history (student_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_classes_updated before update on public.classes
  for each row execute function public.set_updated_at();
create trigger trg_students_updated before update on public.students
  for each row execute function public.set_updated_at();
create trigger trg_focus_updated before update on public.current_focus_items
  for each row execute function public.set_updated_at();
create trigger trg_records_updated before update on public.records
  for each row execute function public.set_updated_at();
create trigger trg_followups_updated before update on public.followups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic parent status change
-- ---------------------------------------------------------------------------
create or replace function public.change_parent_management_status(
  p_student_id uuid,
  p_new_status text,
  p_reason text default null,
  p_changed_at timestamptz default now()
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_status not in (
    'unclassified', 'stable', 'intensive_care',
    'retention_risk', 'temporary_leave', 'withdrawn'
  ) then
    raise exception 'Invalid parent_management_status: %', p_new_status;
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found: %', p_student_id;
  end if;

  if v_student.parent_management_status = p_new_status then
    return v_student;
  end if;

  insert into public.parent_status_history (
    student_id, status, changed_at, reason, changed_by
  ) values (
    p_student_id, p_new_status, coalesce(p_changed_at, now()), p_reason, v_uid
  );

  update public.students
  set
    parent_management_status = p_new_status,
    updated_at = now()
  where id = p_student_id
  returning * into v_student;

  return v_student;
end;
$$;

-- Create student + initial parent status history atomically
create or replace function public.create_student(
  p_korean_name text,
  p_english_name text default null,
  p_class_id uuid default null,
  p_level text default null,
  p_class_days text[] default null,
  p_period text default null,
  p_enrollment_status text default 'active',
  p_parent_management_status text default 'unclassified'
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.students (
    korean_name, english_name, class_id, level, class_days, period,
    enrollment_status, parent_management_status
  ) values (
    p_korean_name, p_english_name, p_class_id, p_level, p_class_days, p_period,
    coalesce(p_enrollment_status, 'active'),
    coalesce(p_parent_management_status, 'unclassified')
  )
  returning * into v_student;

  insert into public.parent_status_history (
    student_id, status, changed_at, reason, changed_by
  ) values (
    v_student.id,
    v_student.parent_management_status,
    now(),
    'Initial status',
    v_uid
  );

  return v_student;
end;
$$;

grant execute on function public.change_parent_management_status(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.create_student(text, text, uuid, text, text[], text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.tags enable row level security;
alter table public.current_focus_items enable row level security;
alter table public.records enable row level security;
alter table public.record_tags enable row level security;
alter table public.followups enable row level security;
alter table public.parent_status_history enable row level security;

create policy "authenticated_all_profiles" on public.profiles
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_classes" on public.classes
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_students" on public.students
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_tags" on public.tags
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_focus" on public.current_focus_items
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_records" on public.records
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_record_tags" on public.record_tags
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_followups" on public.followups
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_parent_history" on public.parent_status_history
  for all to authenticated using (true) with check (true);
