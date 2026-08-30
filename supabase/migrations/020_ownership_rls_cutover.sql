-- 020_ownership_rls_cutover.sql
-- Batch 3 Step 2: Replace broad hub_user_all_* RLS with ownership / shared policies.
-- Depends on: 015 (current policies), 016 (owner_id), 017 (helpers), 019 (indexes OK).
-- Does NOT change NOT NULL or class unique (see 021).
--
-- Explicit transaction: helper CREATE, privilege changes, broad DROP, and new CREATE
-- are atomic. On any failure, no partial RLS cutover remains.
-- Rollback: supabase/maintenance/V1_MULTI_USER_RLS_ROLLBACK.sql (policy swap only).

begin;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, recursion-safe)
-- ---------------------------------------------------------------------------

-- Class SELECT: own class OR metadata needed for owned student's class history.
create or replace function public.can_select_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_class_id is null or auth.uid() is null then false
    when public.owns_class(p_class_id) then true
    when not public.is_student_hub_user() then false
    else exists (
      select 1
      from public.student_class_history sch
      join public.students s on s.id = sch.student_id
      where sch.class_id = p_class_id
        and s.owner_id = auth.uid()
    )
  end;
$$;

comment on function public.can_select_class(uuid) is
  'SELECT gate for classes: owner/admin OR historical metadata for an owned student. Not for write.';

create or replace function public.owns_work_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_note_id is null or auth.uid() is null then false
    when public.is_student_hub_admin() then true
    when not public.is_student_hub_user() then false
    else exists (
      select 1 from public.work_notes w
      where w.id = p_note_id and w.owner_id = auth.uid()
    )
  end;
$$;

create or replace function public.owns_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_message_id is null or auth.uid() is null then false
    when public.is_student_hub_admin() then true
    when not public.is_student_hub_user() then false
    else exists (
      select 1 from public.messages m
      where m.id = p_message_id and m.owner_id = auth.uid()
    )
  end;
$$;

-- Junction: case + record must share student and be owned.
create or replace function public.case_record_link_allowed(p_case_id uuid, p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_case_id is null or p_record_id is null or auth.uid() is null then false
    else exists (
      select 1
      from public.cases c
      join public.records r on r.id = p_record_id
      where c.id = p_case_id
        and c.student_id = r.student_id
        and public.owns_student(c.student_id)
    )
  end;
$$;

create or replace function public.hypothesis_record_link_allowed(
  p_hypothesis_id uuid,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_hypothesis_id is null or p_record_id is null or auth.uid() is null then false
    else exists (
      select 1
      from public.working_hypotheses h
      join public.records r on r.id = p_record_id
      where h.id = p_hypothesis_id
        and h.student_id = r.student_id
        and public.owns_student(h.student_id)
    )
  end;
$$;

create or replace function public.hypothesis_intervention_link_allowed(
  p_hypothesis_id uuid,
  p_intervention_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_hypothesis_id is null or p_intervention_id is null or auth.uid() is null then false
    else exists (
      select 1
      from public.working_hypotheses h
      join public.interventions i on i.id = p_intervention_id
      where h.id = p_hypothesis_id
        and h.student_id = i.student_id
        and public.owns_student(h.student_id)
    )
  end;
$$;

create or replace function public.owns_record(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_record_id is null or auth.uid() is null then false
    else exists (
      select 1 from public.records r
      where r.id = p_record_id
        and public.owns_student(r.student_id)
    )
  end;
$$;

create or replace function public.owns_intervention(p_intervention_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_intervention_id is null or auth.uid() is null then false
    else exists (
      select 1 from public.interventions i
      where i.id = p_intervention_id
        and public.owns_student(i.student_id)
    )
  end;
$$;

-- message_targets write gate (all | owned class | owned student)
create or replace function public.message_target_allowed(
  p_target_type text,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or not public.is_student_hub_user() then false
    when public.is_student_hub_admin() then true
    when p_target_type = 'all' then true
    when p_target_type = 'class' then public.owns_class(p_class_id)
    when p_target_type = 'student' then public.owns_student(p_student_id)
    else false
  end;
$$;

-- ABC: owned student + record (when present) must belong to same student.
-- Schema currently requires record_id NOT NULL; NULL branch is defensive only.
create or replace function public.abc_observation_allowed(
  p_student_id uuid,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_student_id is null or auth.uid() is null then false
    when not public.owns_student(p_student_id) then false
    when p_record_id is null then true
    else exists (
      select 1
      from public.records r
      where r.id = p_record_id
        and r.student_id = p_student_id
    )
  end;
$$;

revoke all on function public.can_select_class(uuid) from public;
revoke all on function public.can_select_class(uuid) from anon;
revoke all on function public.owns_work_note(uuid) from public;
revoke all on function public.owns_work_note(uuid) from anon;
revoke all on function public.owns_message(uuid) from public;
revoke all on function public.owns_message(uuid) from anon;
revoke all on function public.case_record_link_allowed(uuid, uuid) from public;
revoke all on function public.case_record_link_allowed(uuid, uuid) from anon;
revoke all on function public.hypothesis_record_link_allowed(uuid, uuid) from public;
revoke all on function public.hypothesis_record_link_allowed(uuid, uuid) from anon;
revoke all on function public.hypothesis_intervention_link_allowed(uuid, uuid) from public;
revoke all on function public.hypothesis_intervention_link_allowed(uuid, uuid) from anon;
revoke all on function public.owns_record(uuid) from public;
revoke all on function public.owns_record(uuid) from anon;
revoke all on function public.owns_intervention(uuid) from public;
revoke all on function public.owns_intervention(uuid) from anon;
revoke all on function public.message_target_allowed(text, uuid, uuid) from public;
revoke all on function public.message_target_allowed(text, uuid, uuid) from anon;
revoke all on function public.abc_observation_allowed(uuid, uuid) from public;
revoke all on function public.abc_observation_allowed(uuid, uuid) from anon;

grant execute on function public.can_select_class(uuid) to authenticated;
grant execute on function public.owns_work_note(uuid) to authenticated;
grant execute on function public.owns_message(uuid) to authenticated;
grant execute on function public.case_record_link_allowed(uuid, uuid) to authenticated;
grant execute on function public.hypothesis_record_link_allowed(uuid, uuid) to authenticated;
grant execute on function public.hypothesis_intervention_link_allowed(uuid, uuid) to authenticated;
grant execute on function public.owns_record(uuid) to authenticated;
grant execute on function public.owns_intervention(uuid) to authenticated;
grant execute on function public.message_target_allowed(text, uuid, uuid) to authenticated;
grant execute on function public.abc_observation_allowed(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DROP broad hub_user_all_* (and review rename) — atomic with CREATE below
-- ---------------------------------------------------------------------------
drop policy if exists "hub_user_all_profiles" on public.profiles;
drop policy if exists "hub_user_all_classes" on public.classes;
drop policy if exists "hub_user_all_students" on public.students;
drop policy if exists "hub_user_all_tags" on public.tags;
drop policy if exists "hub_user_all_focus" on public.current_focus_items;
drop policy if exists "hub_user_all_records" on public.records;
drop policy if exists "hub_user_all_record_tags" on public.record_tags;
drop policy if exists "hub_user_all_followups" on public.followups;
drop policy if exists "hub_user_all_parent_history" on public.parent_status_history;
drop policy if exists "hub_user_all_levels" on public.levels;
drop policy if exists "hub_user_all_terms" on public.terms;
drop policy if exists "hub_user_all_sch" on public.student_class_history;
drop policy if exists "hub_user_own_review_actions" on public.review_actions;
drop policy if exists "hub_user_all_messages" on public.messages;
drop policy if exists "hub_user_all_message_targets" on public.message_targets;
drop policy if exists "hub_user_all_work_notes" on public.work_notes;
drop policy if exists "hub_user_all_work_note_students" on public.work_note_students;
drop policy if exists "hub_user_all_work_note_classes" on public.work_note_classes;
drop policy if exists "hub_user_all_work_followups" on public.work_followups;
drop policy if exists "hub_user_all_cases" on public.cases;
drop policy if exists "hub_user_all_case_records" on public.case_records;
drop policy if exists "hub_user_all_student_voice" on public.student_voice_entries;
drop policy if exists "hub_user_all_working_hypotheses" on public.working_hypotheses;
drop policy if exists "hub_user_all_hypothesis_records" on public.hypothesis_records;
drop policy if exists "hub_user_all_interventions" on public.interventions;
drop policy if exists "hub_user_all_intervention_responses" on public.intervention_responses;
drop policy if exists "hub_user_all_abc_observations" on public.abc_observations;
drop policy if exists "hub_user_all_context_tags" on public.context_tags;
drop policy if exists "hub_user_all_record_context_tags" on public.record_context_tags;
drop policy if exists "hub_user_all_hypothesis_interventions" on public.hypothesis_interventions;
drop policy if exists "hub_user_all_consultation_notes" on public.consultation_notes;

-- ---------------------------------------------------------------------------
-- Shared masters: terms, levels, tags, context_tags
-- ---------------------------------------------------------------------------
create policy "hub_shared_select_terms" on public.terms
  for select to authenticated
  using (public.is_student_hub_user());
create policy "hub_admin_insert_terms" on public.terms
  for insert to authenticated
  with check (public.is_student_hub_admin());
create policy "hub_admin_update_terms" on public.terms
  for update to authenticated
  using (public.is_student_hub_admin())
  with check (public.is_student_hub_admin());
create policy "hub_admin_delete_terms" on public.terms
  for delete to authenticated
  using (public.is_student_hub_admin());

create policy "hub_shared_select_levels" on public.levels
  for select to authenticated
  using (public.is_student_hub_user());
create policy "hub_admin_insert_levels" on public.levels
  for insert to authenticated
  with check (public.is_student_hub_admin());
create policy "hub_admin_update_levels" on public.levels
  for update to authenticated
  using (public.is_student_hub_admin())
  with check (public.is_student_hub_admin());
create policy "hub_admin_delete_levels" on public.levels
  for delete to authenticated
  using (public.is_student_hub_admin());

create policy "hub_shared_select_tags" on public.tags
  for select to authenticated
  using (public.is_student_hub_user());
create policy "hub_admin_insert_tags" on public.tags
  for insert to authenticated
  with check (public.is_student_hub_admin());
create policy "hub_admin_update_tags" on public.tags
  for update to authenticated
  using (public.is_student_hub_admin())
  with check (public.is_student_hub_admin());
create policy "hub_admin_delete_tags" on public.tags
  for delete to authenticated
  using (public.is_student_hub_admin());

create policy "hub_shared_select_context_tags" on public.context_tags
  for select to authenticated
  using (public.is_student_hub_user());
create policy "hub_admin_insert_context_tags" on public.context_tags
  for insert to authenticated
  with check (public.is_student_hub_admin());
create policy "hub_admin_update_context_tags" on public.context_tags
  for update to authenticated
  using (public.is_student_hub_admin())
  with check (public.is_student_hub_admin());
create policy "hub_admin_delete_context_tags" on public.context_tags
  for delete to authenticated
  using (public.is_student_hub_admin());

-- ---------------------------------------------------------------------------
-- profiles — own row only; admin SELECT all; no teacher role escalation path
-- (profiles.role is NOT Hub ACL; still block cross-user UPDATE)
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_profiles" on public.profiles
  for select to authenticated
  using (
    public.is_student_hub_user()
    and (id = auth.uid() or public.is_student_hub_admin())
  );
create policy "hub_owner_insert_profiles" on public.profiles
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and id = auth.uid()
  );
create policy "hub_owner_update_profiles" on public.profiles
  for update to authenticated
  using (public.is_student_hub_user() and id = auth.uid())
  with check (public.is_student_hub_user() and id = auth.uid());
create policy "hub_admin_delete_profiles" on public.profiles
  for delete to authenticated
  using (public.is_student_hub_admin());

-- ---------------------------------------------------------------------------
-- students — ownership root
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_students" on public.students
  for select to authenticated
  using (public.owns_student(id));
create policy "hub_owner_insert_students" on public.students
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_update_students" on public.students
  for update to authenticated
  using (public.owns_student(id))
  with check (
    public.is_student_hub_admin()
    or (public.is_student_hub_user() and owner_id = auth.uid())
  );
create policy "hub_owner_delete_students" on public.students
  for delete to authenticated
  using (public.owns_student(id));

-- ---------------------------------------------------------------------------
-- classes — teacher-owned writes; SELECT includes historical metadata exception
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_classes" on public.classes
  for select to authenticated
  using (public.can_select_class(id));
create policy "hub_owner_insert_classes" on public.classes
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_update_classes" on public.classes
  for update to authenticated
  using (public.owns_class(id))
  with check (
    public.is_student_hub_admin()
    or (public.is_student_hub_user() and owner_id = auth.uid())
  );
create policy "hub_owner_delete_classes" on public.classes
  for delete to authenticated
  using (public.owns_class(id));

-- ---------------------------------------------------------------------------
-- student_class_history — student root; write also requires owns_class
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_sch" on public.student_class_history
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_sch" on public.student_class_history
  for insert to authenticated
  with check (
    public.owns_student(student_id)
    and public.owns_class(class_id)
  );
create policy "hub_owner_update_sch" on public.student_class_history
  for update to authenticated
  using (public.owns_student(student_id))
  with check (
    public.owns_student(student_id)
    and public.owns_class(class_id)
  );
create policy "hub_owner_delete_sch" on public.student_class_history
  for delete to authenticated
  using (public.owns_student(student_id));

-- ---------------------------------------------------------------------------
-- Direct student-scoped tables
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_focus" on public.current_focus_items
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_focus" on public.current_focus_items
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_focus" on public.current_focus_items
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_focus" on public.current_focus_items
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_records" on public.records
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_records" on public.records
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_records" on public.records
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_records" on public.records
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_parent_history" on public.parent_status_history
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_parent_history" on public.parent_status_history
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_parent_history" on public.parent_status_history
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_parent_history" on public.parent_status_history
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_cases" on public.cases
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_cases" on public.cases
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_cases" on public.cases
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_cases" on public.cases
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_student_voice" on public.student_voice_entries
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_student_voice" on public.student_voice_entries
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_student_voice" on public.student_voice_entries
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_student_voice" on public.student_voice_entries
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_working_hypotheses" on public.working_hypotheses
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_working_hypotheses" on public.working_hypotheses
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_working_hypotheses" on public.working_hypotheses
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_working_hypotheses" on public.working_hypotheses
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_interventions" on public.interventions
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_interventions" on public.interventions
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_interventions" on public.interventions
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_interventions" on public.interventions
  for delete to authenticated
  using (public.owns_student(student_id));

create policy "hub_owner_select_abc_observations" on public.abc_observations
  for select to authenticated
  using (public.abc_observation_allowed(student_id, record_id));
create policy "hub_owner_insert_abc_observations" on public.abc_observations
  for insert to authenticated
  with check (public.abc_observation_allowed(student_id, record_id));
create policy "hub_owner_update_abc_observations" on public.abc_observations
  for update to authenticated
  using (public.abc_observation_allowed(student_id, record_id))
  with check (public.abc_observation_allowed(student_id, record_id));
create policy "hub_owner_delete_abc_observations" on public.abc_observations
  for delete to authenticated
  using (public.abc_observation_allowed(student_id, record_id));

create policy "hub_owner_select_consultation_notes" on public.consultation_notes
  for select to authenticated
  using (public.owns_student(student_id));
create policy "hub_owner_insert_consultation_notes" on public.consultation_notes
  for insert to authenticated
  with check (public.owns_student(student_id));
create policy "hub_owner_update_consultation_notes" on public.consultation_notes
  for update to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));
create policy "hub_owner_delete_consultation_notes" on public.consultation_notes
  for delete to authenticated
  using (public.owns_student(student_id));

-- ---------------------------------------------------------------------------
-- Indirect / junction tables
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_record_tags" on public.record_tags
  for select to authenticated
  using (public.owns_record(record_id));
create policy "hub_owner_insert_record_tags" on public.record_tags
  for insert to authenticated
  with check (public.owns_record(record_id));
create policy "hub_owner_update_record_tags" on public.record_tags
  for update to authenticated
  using (public.owns_record(record_id))
  with check (public.owns_record(record_id));
create policy "hub_owner_delete_record_tags" on public.record_tags
  for delete to authenticated
  using (public.owns_record(record_id));

create policy "hub_owner_select_followups" on public.followups
  for select to authenticated
  using (public.owns_record(record_id));
create policy "hub_owner_insert_followups" on public.followups
  for insert to authenticated
  with check (public.owns_record(record_id));
create policy "hub_owner_update_followups" on public.followups
  for update to authenticated
  using (public.owns_record(record_id))
  with check (public.owns_record(record_id));
create policy "hub_owner_delete_followups" on public.followups
  for delete to authenticated
  using (public.owns_record(record_id));

create policy "hub_owner_select_record_context_tags" on public.record_context_tags
  for select to authenticated
  using (public.owns_record(record_id));
create policy "hub_owner_insert_record_context_tags" on public.record_context_tags
  for insert to authenticated
  with check (public.owns_record(record_id));
create policy "hub_owner_update_record_context_tags" on public.record_context_tags
  for update to authenticated
  using (public.owns_record(record_id))
  with check (public.owns_record(record_id));
create policy "hub_owner_delete_record_context_tags" on public.record_context_tags
  for delete to authenticated
  using (public.owns_record(record_id));

create policy "hub_owner_select_case_records" on public.case_records
  for select to authenticated
  using (public.case_record_link_allowed(case_id, record_id));
create policy "hub_owner_insert_case_records" on public.case_records
  for insert to authenticated
  with check (public.case_record_link_allowed(case_id, record_id));
create policy "hub_owner_update_case_records" on public.case_records
  for update to authenticated
  using (public.case_record_link_allowed(case_id, record_id))
  with check (public.case_record_link_allowed(case_id, record_id));
create policy "hub_owner_delete_case_records" on public.case_records
  for delete to authenticated
  using (public.case_record_link_allowed(case_id, record_id));

create policy "hub_owner_select_hypothesis_records" on public.hypothesis_records
  for select to authenticated
  using (public.hypothesis_record_link_allowed(hypothesis_id, record_id));
create policy "hub_owner_insert_hypothesis_records" on public.hypothesis_records
  for insert to authenticated
  with check (public.hypothesis_record_link_allowed(hypothesis_id, record_id));
create policy "hub_owner_update_hypothesis_records" on public.hypothesis_records
  for update to authenticated
  using (public.hypothesis_record_link_allowed(hypothesis_id, record_id))
  with check (public.hypothesis_record_link_allowed(hypothesis_id, record_id));
create policy "hub_owner_delete_hypothesis_records" on public.hypothesis_records
  for delete to authenticated
  using (public.hypothesis_record_link_allowed(hypothesis_id, record_id));

create policy "hub_owner_select_intervention_responses" on public.intervention_responses
  for select to authenticated
  using (public.owns_intervention(intervention_id));
create policy "hub_owner_insert_intervention_responses" on public.intervention_responses
  for insert to authenticated
  with check (public.owns_intervention(intervention_id));
create policy "hub_owner_update_intervention_responses" on public.intervention_responses
  for update to authenticated
  using (public.owns_intervention(intervention_id))
  with check (public.owns_intervention(intervention_id));
create policy "hub_owner_delete_intervention_responses" on public.intervention_responses
  for delete to authenticated
  using (public.owns_intervention(intervention_id));

create policy "hub_owner_select_hypothesis_interventions" on public.hypothesis_interventions
  for select to authenticated
  using (public.hypothesis_intervention_link_allowed(hypothesis_id, intervention_id));
create policy "hub_owner_insert_hypothesis_interventions" on public.hypothesis_interventions
  for insert to authenticated
  with check (public.hypothesis_intervention_link_allowed(hypothesis_id, intervention_id));
create policy "hub_owner_update_hypothesis_interventions" on public.hypothesis_interventions
  for update to authenticated
  using (public.hypothesis_intervention_link_allowed(hypothesis_id, intervention_id))
  with check (public.hypothesis_intervention_link_allowed(hypothesis_id, intervention_id));
create policy "hub_owner_delete_hypothesis_interventions" on public.hypothesis_interventions
  for delete to authenticated
  using (public.hypothesis_intervention_link_allowed(hypothesis_id, intervention_id));

-- ---------------------------------------------------------------------------
-- review_actions — user-private + owned student
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_review_actions" on public.review_actions
  for select to authenticated
  using (
    public.is_student_hub_user()
    and user_id = auth.uid()
    and public.owns_student(student_id)
  );
create policy "hub_owner_insert_review_actions" on public.review_actions
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and user_id = auth.uid()
    and public.owns_student(student_id)
  );
create policy "hub_owner_update_review_actions" on public.review_actions
  for update to authenticated
  using (
    public.is_student_hub_user()
    and user_id = auth.uid()
    and public.owns_student(student_id)
  )
  with check (
    public.is_student_hub_user()
    and user_id = auth.uid()
    and public.owns_student(student_id)
  );
create policy "hub_owner_delete_review_actions" on public.review_actions
  for delete to authenticated
  using (
    public.is_student_hub_user()
    and user_id = auth.uid()
    and public.owns_student(student_id)
  );

-- ---------------------------------------------------------------------------
-- work_notes (teacher-private) + children
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_work_notes" on public.work_notes
  for select to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_insert_work_notes" on public.work_notes
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_update_work_notes" on public.work_notes
  for update to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  )
  with check (
    public.is_student_hub_admin()
    or (public.is_student_hub_user() and owner_id = auth.uid())
  );
create policy "hub_owner_delete_work_notes" on public.work_notes
  for delete to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );

create policy "hub_owner_select_work_note_students" on public.work_note_students
  for select to authenticated
  using (public.owns_work_note(work_note_id));
create policy "hub_owner_insert_work_note_students" on public.work_note_students
  for insert to authenticated
  with check (
    public.owns_work_note(work_note_id)
    and public.owns_student(student_id)
  );
create policy "hub_owner_update_work_note_students" on public.work_note_students
  for update to authenticated
  using (public.owns_work_note(work_note_id))
  with check (
    public.owns_work_note(work_note_id)
    and public.owns_student(student_id)
  );
create policy "hub_owner_delete_work_note_students" on public.work_note_students
  for delete to authenticated
  using (public.owns_work_note(work_note_id));

create policy "hub_owner_select_work_note_classes" on public.work_note_classes
  for select to authenticated
  using (public.owns_work_note(work_note_id));
create policy "hub_owner_insert_work_note_classes" on public.work_note_classes
  for insert to authenticated
  with check (
    public.owns_work_note(work_note_id)
    and public.owns_class(class_id)
  );
create policy "hub_owner_update_work_note_classes" on public.work_note_classes
  for update to authenticated
  using (public.owns_work_note(work_note_id))
  with check (
    public.owns_work_note(work_note_id)
    and public.owns_class(class_id)
  );
create policy "hub_owner_delete_work_note_classes" on public.work_note_classes
  for delete to authenticated
  using (public.owns_work_note(work_note_id));

create policy "hub_owner_select_work_followups" on public.work_followups
  for select to authenticated
  using (public.owns_work_note(work_note_id));
create policy "hub_owner_insert_work_followups" on public.work_followups
  for insert to authenticated
  with check (public.owns_work_note(work_note_id));
create policy "hub_owner_update_work_followups" on public.work_followups
  for update to authenticated
  using (public.owns_work_note(work_note_id))
  with check (public.owns_work_note(work_note_id));
create policy "hub_owner_delete_work_followups" on public.work_followups
  for delete to authenticated
  using (public.owns_work_note(work_note_id));

-- ---------------------------------------------------------------------------
-- messages (teacher-private) + targets
-- ---------------------------------------------------------------------------
create policy "hub_owner_select_messages" on public.messages
  for select to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_insert_messages" on public.messages
  for insert to authenticated
  with check (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );
create policy "hub_owner_update_messages" on public.messages
  for update to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  )
  with check (
    public.is_student_hub_admin()
    or (public.is_student_hub_user() and owner_id = auth.uid())
  );
create policy "hub_owner_delete_messages" on public.messages
  for delete to authenticated
  using (
    public.is_student_hub_user()
    and (
      public.is_student_hub_admin()
      or owner_id = auth.uid()
    )
  );

create policy "hub_owner_select_message_targets" on public.message_targets
  for select to authenticated
  using (public.owns_message(message_id));
create policy "hub_owner_insert_message_targets" on public.message_targets
  for insert to authenticated
  with check (
    public.owns_message(message_id)
    and public.message_target_allowed(target_type, class_id, student_id)
  );
create policy "hub_owner_update_message_targets" on public.message_targets
  for update to authenticated
  using (public.owns_message(message_id))
  with check (
    public.owns_message(message_id)
    and public.message_target_allowed(target_type, class_id, student_id)
  );
create policy "hub_owner_delete_message_targets" on public.message_targets
  for delete to authenticated
  using (public.owns_message(message_id));

-- allowed_student_hub_users: intentionally no client policies (unchanged).

commit;
