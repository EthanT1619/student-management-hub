-- 013: Add management status "신규" (new_student)
-- Extends parent_management_status check constraints + RPC allow-list.

do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  where c.conrelid = 'public.students'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%parent_management_status%';
  if con_name is not null then
    execute format('alter table public.students drop constraint %I', con_name);
  end if;
end $$;

alter table public.students
  add constraint students_parent_management_status_check
  check (parent_management_status in (
    'unclassified', 'stable', 'intensive_care',
    'retention_risk', 'temporary_leave', 'withdrawn',
    'new_student'
  ));

do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  where c.conrelid = 'public.parent_status_history'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%';
  if con_name is not null then
    execute format('alter table public.parent_status_history drop constraint %I', con_name);
  end if;
end $$;

alter table public.parent_status_history
  add constraint parent_status_history_status_check
  check (status in (
    'unclassified', 'stable', 'intensive_care',
    'retention_risk', 'temporary_leave', 'withdrawn',
    'new_student'
  ));

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
    'retention_risk', 'temporary_leave', 'withdrawn',
    'new_student'
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
    student_id, status, reason, changed_at, changed_by
  ) values (
    p_student_id, p_new_status, p_reason, p_changed_at, v_uid
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

grant execute on function public.change_parent_management_status(uuid, text, text, timestamptz) to authenticated;
