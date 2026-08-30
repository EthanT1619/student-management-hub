-- 018_rpc_ownership_hardening.sql
-- Batch 2: Harden SECURITY DEFINER mutating RPCs with admin/ownership guards.
-- Depends on: 017_ownership_helpers.sql
--
-- Does NOT change RLS, class unique indexes, or owner_id NOT NULL.
--
-- TRANSITIONAL LIMITATION (until Batch 3 owner-aware unique):
-- classes still unique on (term_id, level_id, days_code, period) without owner_id.
-- Teacher B creating the same keys as Teacher A may hit a unique violation.
-- create_class never returns another teacher's row (owner-scoped lookup).

-- ---------------------------------------------------------------------------
-- ensure_level — admin only
-- ---------------------------------------------------------------------------
create or replace function public.ensure_level(p_name text, p_sort_order integer default 0)
returns public.levels
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.levels;
  v_name text := trim(p_name);
begin
  perform public.assert_student_hub_admin();

  if v_name is null or v_name = '' then
    raise exception 'Level name required';
  end if;

  insert into public.levels (name, sort_order)
  values (v_name, coalesce(p_sort_order, 0))
  on conflict (name) do update set sort_order = public.levels.sort_order
  returning * into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_current_term — admin only
-- ---------------------------------------------------------------------------
create or replace function public.set_current_term(p_term_id uuid)
returns public.terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.terms;
begin
  perform public.assert_student_hub_admin();

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

-- ---------------------------------------------------------------------------
-- create_student — force owner_id; class must be owned
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
  perform public.assert_student_hub_user();

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_class_id is not null then
    perform public.assert_owns_class(p_class_id);
  end if;

  insert into public.students (
    korean_name, english_name, class_id,
    enrollment_status, parent_management_status,
    owner_id
  ) values (
    p_korean_name, p_english_name, p_class_id,
    coalesce(p_enrollment_status, 'active'),
    coalesce(p_parent_management_status, 'unclassified'),
    v_uid
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
-- create_class — owner-scoped dedupe + owner_id; level lookup (ensure_level admin-only)
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
  v_level_name text := trim(p_level_name);
begin
  perform public.assert_student_hub_user();

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_days_code not in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET') then
    raise exception 'Invalid days_code: %', p_days_code;
  end if;

  if v_period is null or v_period = '' then
    raise exception 'Period required';
  end if;

  if v_level_name is null or v_level_name = '' then
    raise exception 'Level name required';
  end if;

  v_term_id := p_term_id;
  if v_term_id is null then
    select id into v_term_id from public.terms where is_current = true limit 1;
  end if;
  if v_term_id is null then
    raise exception 'No current term; create a term first';
  end if;

  select * into v_level from public.levels where name = v_level_name;
  if not found then
    if public.is_student_hub_admin() then
      v_level := public.ensure_level(v_level_name);
    else
      raise exception
        'Level not found: %. Ask an admin to add this shared level first.',
        v_level_name;
    end if;
  end if;

  -- Owner-scoped dedupe only (never return another teacher's class)
  select * into v_class
  from public.classes
  where term_id = v_term_id
    and level_id = v_level.id
    and days_code = p_days_code
    and period = v_period
    and owner_id = v_uid
  limit 1;

  if found then
    return v_class;
  end if;

  -- May still conflict with classes_term_level_days_period_uidx until Batch 3.
  insert into public.classes (
    term_id, level_id, days_code, period, is_active, sort_order, owner_id
  ) values (
    v_term_id, v_level.id, p_days_code, v_period, true, 0, v_uid
  )
  returning * into v_class;

  return v_class;
end;
$$;

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
  perform public.assert_student_hub_user();
  return public.create_class(p_level_name, p_days_code, p_period, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_class — must own class; do not change owner_id; level lookup rules
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
  v_level public.levels;
  v_level_id uuid;
  v_days text;
  v_period text;
  v_level_name text;
begin
  perform public.assert_owns_class(p_class_id);

  select * into v_class from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Class not found: %', p_class_id;
  end if;

  if p_level_name is not null and trim(p_level_name) <> '' then
    v_level_name := trim(p_level_name);
    select * into v_level from public.levels where name = v_level_name;
    if not found then
      if public.is_student_hub_admin() then
        v_level := public.ensure_level(v_level_name);
      else
        raise exception
          'Level not found: %. Ask an admin to add this shared level first.',
          v_level_name;
      end if;
    end if;
    v_level_id := v_level.id;
  else
    v_level_id := v_class.level_id;
  end if;

  v_days := coalesce(p_days_code, v_class.days_code);
  if v_days not in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET') then
    raise exception 'Invalid days_code: %', v_days;
  end if;

  v_period := coalesce(nullif(trim(p_period), ''), v_class.period);

  -- owner_id intentionally not updated (no ownership transfer via this RPC)
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

-- ---------------------------------------------------------------------------
-- change_student_class
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
  perform public.assert_owns_student(p_student_id);

  if p_new_class_id is null then
    raise exception 'New class_id required';
  end if;

  perform public.assert_owns_class(p_new_class_id);

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

-- ---------------------------------------------------------------------------
-- clear_student_class
-- ---------------------------------------------------------------------------
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
  v_end date := coalesce(p_end_date, current_date);
begin
  perform public.assert_owns_student(p_student_id);

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
    end_date = greatest(v_end, start_date),
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

-- ---------------------------------------------------------------------------
-- change_parent_management_status
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
  perform public.assert_owns_student(p_student_id);

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

-- Explicit EXECUTE privileges (do not rely on older migration privilege state).
-- Order: REVOKE PUBLIC/anon, then GRANT authenticated.

revoke all on function public.ensure_level(text, integer) from public;
revoke all on function public.ensure_level(text, integer) from anon;
grant execute on function public.ensure_level(text, integer) to authenticated;

revoke all on function public.set_current_term(uuid) from public;
revoke all on function public.set_current_term(uuid) from anon;
grant execute on function public.set_current_term(uuid) to authenticated;

revoke all on function public.create_student(text, text, uuid, text, text) from public;
revoke all on function public.create_student(text, text, uuid, text, text) from anon;
grant execute on function public.create_student(text, text, uuid, text, text) to authenticated;

revoke all on function public.create_class(text, text, text, uuid) from public;
revoke all on function public.create_class(text, text, text, uuid) from anon;
grant execute on function public.create_class(text, text, text, uuid) to authenticated;

revoke all on function public.create_class(text, text, text) from public;
revoke all on function public.create_class(text, text, text) from anon;
grant execute on function public.create_class(text, text, text) to authenticated;

revoke all on function public.update_class(uuid, text, text, text, boolean) from public;
revoke all on function public.update_class(uuid, text, text, text, boolean) from anon;
grant execute on function public.update_class(uuid, text, text, text, boolean) to authenticated;

revoke all on function public.change_student_class(uuid, uuid, date, text) from public;
revoke all on function public.change_student_class(uuid, uuid, date, text) from anon;
grant execute on function public.change_student_class(uuid, uuid, date, text) to authenticated;

revoke all on function public.clear_student_class(uuid, date, text) from public;
revoke all on function public.clear_student_class(uuid, date, text) from anon;
grant execute on function public.clear_student_class(uuid, date, text) to authenticated;

revoke all on function public.change_parent_management_status(uuid, text, text, timestamptz) from public;
revoke all on function public.change_parent_management_status(uuid, text, text, timestamptz) from anon;
grant execute on function public.change_parent_management_status(uuid, text, text, timestamptz) to authenticated;
