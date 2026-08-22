-- 003_terms_and_class_history.sql
-- Terms + Class.term_id + student_class_history
-- Preserves students / records / followups / stamps / focus / parent status.
-- Requires 002_class_structure.sql already applied.

-- ---------------------------------------------------------------------------
-- terms
-- ---------------------------------------------------------------------------
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create trigger trg_terms_updated
  before update on public.terms
  for each row execute function public.set_updated_at();

-- At most one current term
create unique index if not exists terms_one_current_uidx
  on public.terms ((is_current))
  where is_current = true;

alter table public.terms enable row level security;
drop policy if exists "authenticated_all_terms" on public.terms;
create policy "authenticated_all_terms" on public.terms
  for all to authenticated using (true) with check (true);

-- Seed default current term for existing data (idempotent)
insert into public.terms (name, start_date, end_date, is_current)
select '초기 학기', current_date - 90, null, true
where not exists (select 1 from public.terms);

-- ---------------------------------------------------------------------------
-- classes.term_id
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists term_id uuid references public.terms (id) on delete restrict;

update public.classes c
set term_id = t.id
from public.terms t
where c.term_id is null
  and t.is_current = true;

-- Fallback if somehow no current term
update public.classes
set term_id = (select id from public.terms order by created_at limit 1)
where term_id is null;

alter table public.classes
  alter column term_id set not null;

-- Replace uniqueness: was (level_id, days_code, period)
drop index if exists classes_level_days_period_uidx;

create unique index if not exists classes_term_level_days_period_uidx
  on public.classes (term_id, level_id, days_code, period);

create index if not exists idx_classes_term_id on public.classes (term_id);

-- ---------------------------------------------------------------------------
-- student_class_history
-- ---------------------------------------------------------------------------
create table if not exists public.student_class_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  start_date date not null default (current_date),
  end_date date,
  is_current boolean not null default true,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (
    (is_current = true and end_date is null)
    or (is_current = false and end_date is not null)
  )
);

create trigger trg_student_class_history_updated
  before update on public.student_class_history
  for each row execute function public.set_updated_at();

create unique index if not exists student_class_history_one_current_uidx
  on public.student_class_history (student_id)
  where is_current = true;

create index if not exists idx_sch_student_dates
  on public.student_class_history (student_id, start_date desc);

create index if not exists idx_sch_class_id
  on public.student_class_history (class_id);

alter table public.student_class_history enable row level security;
drop policy if exists "authenticated_all_sch" on public.student_class_history;
create policy "authenticated_all_sch" on public.student_class_history
  for all to authenticated using (true) with check (true);

-- Backfill: one current history row per student who already has class_id
insert into public.student_class_history (
  student_id, class_id, start_date, end_date, is_current, note
)
select
  s.id,
  s.class_id,
  coalesce(s.created_at::date, current_date),
  null,
  true,
  'Backfilled from existing class_id'
from public.students s
where s.class_id is not null
  and not exists (
    select 1 from public.student_class_history h
    where h.student_id = s.id and h.is_current = true
  );

-- ---------------------------------------------------------------------------
-- Atomic class change RPC
-- ---------------------------------------------------------------------------
create or replace function public.change_student_class(
  p_student_id uuid,
  p_new_class_id uuid,
  p_start_date date default current_date,
  p_note text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
  v_start date := coalesce(p_start_date, current_date);
  v_end_prev date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_class_id is null then
    raise exception 'New class_id required';
  end if;

  if not exists (select 1 from public.classes where id = p_new_class_id) then
    raise exception 'Class not found: %', p_new_class_id;
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found: %', p_student_id;
  end if;

  if v_student.class_id is not distinct from p_new_class_id then
    return v_student;
  end if;

  -- Close current history (if any)
  v_end_prev := greatest(
    v_start - 1,
    coalesce(
      (select start_date from public.student_class_history
       where student_id = p_student_id and is_current = true
       limit 1),
      v_start - 1
    )
  );

  update public.student_class_history
  set
    is_current = false,
    end_date = v_end_prev,
    updated_at = now()
  where student_id = p_student_id
    and is_current = true;

  insert into public.student_class_history (
    student_id, class_id, start_date, end_date, is_current, note, changed_by
  ) values (
    p_student_id, p_new_class_id, v_start, null, true, p_note, v_uid
  );

  update public.students
  set class_id = p_new_class_id, updated_at = now()
  where id = p_student_id
  returning * into v_student;

  return v_student;
end;
$$;

grant execute on function public.change_student_class(uuid, uuid, date, text) to authenticated;

-- Unassign class (clear current) — optional but useful
create or replace function public.clear_student_class(
  p_student_id uuid,
  p_end_date date default current_date,
  p_note text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
  v_end date := coalesce(p_end_date, current_date);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found: %', p_student_id;
  end if;

  if v_student.class_id is null then
    return v_student;
  end if;

  update public.student_class_history
  set
    is_current = false,
    end_date = greatest(
      v_end,
      start_date
    ),
    note = coalesce(p_note, note),
    updated_at = now()
  where student_id = p_student_id
    and is_current = true;

  update public.students
  set class_id = null, updated_at = now()
  where id = p_student_id
  returning * into v_student;

  return v_student;
end;
$$;

grant execute on function public.clear_student_class(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_student: also open history when class assigned
-- ---------------------------------------------------------------------------
create or replace function public.create_student(
  p_korean_name text,
  p_english_name text default null,
  p_class_id uuid default null,
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
    korean_name, english_name, class_id,
    enrollment_status, parent_management_status
  ) values (
    p_korean_name, p_english_name, p_class_id,
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

  if p_class_id is not null then
    insert into public.student_class_history (
      student_id, class_id, start_date, end_date, is_current, note, changed_by
    ) values (
      v_student.id, p_class_id, current_date, null, true, 'Initial class assignment', v_uid
    );
  end if;

  return v_student;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_class: require term (default = current term)
-- ---------------------------------------------------------------------------
create or replace function public.create_class(
  p_level_name text,
  p_days_code text,
  p_period text,
  p_term_id uuid default null
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level public.levels;
  v_class public.classes;
  v_uid uuid := auth.uid();
  v_period text := trim(p_period);
  v_term_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_days_code not in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET') then
    raise exception 'Invalid days_code: %', p_days_code;
  end if;

  if v_period is null or v_period = '' then
    raise exception 'Period required';
  end if;

  v_term_id := p_term_id;
  if v_term_id is null then
    select id into v_term_id from public.terms where is_current = true limit 1;
  end if;
  if v_term_id is null then
    raise exception 'No current term; create a term first';
  end if;

  v_level := public.ensure_level(p_level_name);

  select * into v_class
  from public.classes
  where term_id = v_term_id
    and level_id = v_level.id
    and days_code = p_days_code
    and period = v_period
  limit 1;

  if found then
    return v_class;
  end if;

  insert into public.classes (term_id, level_id, days_code, period, is_active, sort_order)
  values (v_term_id, v_level.id, p_days_code, v_period, true, 0)
  returning * into v_class;

  return v_class;
end;
$$;

grant execute on function public.create_class(text, text, text, uuid) to authenticated;

-- Keep 3-arg overload for older clients by wrapping
create or replace function public.create_class(
  p_level_name text,
  p_days_code text,
  p_period text
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_class(p_level_name, p_days_code, p_period, null);
end;
$$;

grant execute on function public.create_class(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_class: ops/typo fixes only — term_id cannot change
-- ---------------------------------------------------------------------------
create or replace function public.update_class(
  p_class_id uuid,
  p_level_name text default null,
  p_days_code text default null,
  p_period text default null,
  p_is_active boolean default null
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes;
  v_uid uuid := auth.uid();
  v_level public.levels;
  v_level_id uuid;
  v_days text;
  v_period text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_class from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Class not found: %', p_class_id;
  end if;

  -- term_id intentionally immutable here (new term = new class)

  if p_level_name is not null and trim(p_level_name) <> '' then
    v_level := public.ensure_level(trim(p_level_name));
    v_level_id := v_level.id;
  else
    v_level_id := v_class.level_id;
  end if;

  v_days := coalesce(p_days_code, v_class.days_code);
  if v_days not in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET') then
    raise exception 'Invalid days_code: %', v_days;
  end if;

  v_period := coalesce(nullif(trim(p_period), ''), v_class.period);

  update public.classes
  set
    level_id = v_level_id,
    days_code = v_days,
    period = v_period,
    is_active = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = p_class_id
  returning * into v_class;

  return v_class;
end;
$$;

grant execute on function public.update_class(uuid, text, text, text, boolean) to authenticated;

-- Helper: set current term (clears previous)
create or replace function public.set_current_term(p_term_id uuid)
returns public.terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.terms;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.terms set is_current = false where is_current = true;
  update public.terms
  set is_current = true, updated_at = now()
  where id = p_term_id
  returning * into v;

  if not found then
    raise exception 'Term not found: %', p_term_id;
  end if;
  return v;
end;
$$;

grant execute on function public.set_current_term(uuid) to authenticated;
