-- 015_security_rls_lockdown.sql
-- WARN: Owner Google email MUST already be in public.allowed_student_hub_users
-- (active) before applying this migration, or you will lock yourself out.
-- Depends on 014_security_allowlist.sql (is_student_hub_user / assert_student_hub_user).
--
-- Before running:
--   insert into public.allowed_student_hub_users (email, note)
--   values ('YOUR_GOOGLE_EMAIL@example.com', 'owner');

-- ---------------------------------------------------------------------------
-- Drop broad authenticated policies
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated_all_profiles" on public.profiles;
drop policy if exists "authenticated_all_classes" on public.classes;
drop policy if exists "authenticated_all_students" on public.students;
drop policy if exists "authenticated_all_tags" on public.tags;
drop policy if exists "authenticated_all_focus" on public.current_focus_items;
drop policy if exists "authenticated_all_records" on public.records;
drop policy if exists "authenticated_all_record_tags" on public.record_tags;
drop policy if exists "authenticated_all_followups" on public.followups;
drop policy if exists "authenticated_all_parent_history" on public.parent_status_history;
drop policy if exists "authenticated_all_levels" on public.levels;
drop policy if exists "authenticated_all_terms" on public.terms;
drop policy if exists "authenticated_all_sch" on public.student_class_history;
drop policy if exists "users_own_review_actions" on public.review_actions;
drop policy if exists "authenticated_all_messages" on public.messages;
drop policy if exists "authenticated_all_message_targets" on public.message_targets;
drop policy if exists "authenticated_all_work_notes" on public.work_notes;
drop policy if exists "authenticated_all_work_note_students" on public.work_note_students;
drop policy if exists "authenticated_all_work_note_classes" on public.work_note_classes;
drop policy if exists "authenticated_all_work_followups" on public.work_followups;
drop policy if exists "authenticated_all_cases" on public.cases;
drop policy if exists "authenticated_all_case_records" on public.case_records;
drop policy if exists "authenticated_all_student_voice" on public.student_voice_entries;
drop policy if exists "authenticated_all_working_hypotheses" on public.working_hypotheses;
drop policy if exists "authenticated_all_hypothesis_records" on public.hypothesis_records;
drop policy if exists "authenticated_all_interventions" on public.interventions;
drop policy if exists "authenticated_all_intervention_responses" on public.intervention_responses;
drop policy if exists "authenticated_all_abc_observations" on public.abc_observations;
drop policy if exists "authenticated_all_context_tags" on public.context_tags;
drop policy if exists "authenticated_all_record_context_tags" on public.record_context_tags;
drop policy if exists "authenticated_all_hypothesis_interventions" on public.hypothesis_interventions;
drop policy if exists "authenticated_all_consultation_notes" on public.consultation_notes;

-- ---------------------------------------------------------------------------
-- Hub-user policies (allowlist-gated)
-- No policies on allowed_student_hub_users (deny-by-default with RLS on).
-- ---------------------------------------------------------------------------
create policy "hub_user_all_profiles" on public.profiles
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_classes" on public.classes
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_students" on public.students
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_tags" on public.tags
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_focus" on public.current_focus_items
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_records" on public.records
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_record_tags" on public.record_tags
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_followups" on public.followups
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_parent_history" on public.parent_status_history
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_levels" on public.levels
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_terms" on public.terms
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_sch" on public.student_class_history
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_own_review_actions" on public.review_actions
  for all to authenticated
  using (user_id = auth.uid() and public.is_student_hub_user())
  with check (user_id = auth.uid() and public.is_student_hub_user());

create policy "hub_user_all_messages" on public.messages
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_message_targets" on public.message_targets
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_work_notes" on public.work_notes
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_work_note_students" on public.work_note_students
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_work_note_classes" on public.work_note_classes
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_work_followups" on public.work_followups
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_cases" on public.cases
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_case_records" on public.case_records
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_student_voice" on public.student_voice_entries
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_working_hypotheses" on public.working_hypotheses
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_hypothesis_records" on public.hypothesis_records
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_interventions" on public.interventions
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_intervention_responses" on public.intervention_responses
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_abc_observations" on public.abc_observations
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_context_tags" on public.context_tags
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_record_context_tags" on public.record_context_tags
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_hypothesis_interventions" on public.hypothesis_interventions
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

create policy "hub_user_all_consultation_notes" on public.consultation_notes
  for all to authenticated
  using (public.is_student_hub_user())
  with check (public.is_student_hub_user());

-- ---------------------------------------------------------------------------
-- RPC hardening: assert_student_hub_user at start (keep existing behavior)
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
  perform public.assert_student_hub_user();

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
  perform public.assert_student_hub_user();

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
  perform public.assert_student_hub_user();

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
  perform public.assert_student_hub_user();

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
  perform public.assert_student_hub_user();

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
  perform public.assert_student_hub_user();

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

create or replace function public.ensure_level(p_name text, p_sort_order integer default 0)
returns public.levels
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.levels;
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
begin
  perform public.assert_student_hub_user();

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

-- Re-grant execute to authenticated
grant execute on function public.change_parent_management_status(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.change_student_class(uuid, uuid, date, text) to authenticated;
grant execute on function public.clear_student_class(uuid, date, text) to authenticated;
grant execute on function public.create_student(text, text, uuid, text, text) to authenticated;
grant execute on function public.create_class(text, text, text, uuid) to authenticated;
grant execute on function public.create_class(text, text, text) to authenticated;
grant execute on function public.update_class(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.set_current_term(uuid) to authenticated;
grant execute on function public.ensure_level(text, integer) to authenticated;
