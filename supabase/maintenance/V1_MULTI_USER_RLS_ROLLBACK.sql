-- =============================================================================
-- Student Hub — Multi-User RLS ROLLBACK (policy swap ONLY)
-- File: supabase/maintenance/V1_MULTI_USER_RLS_ROLLBACK.sql
--
-- Purpose: If 020 ownership RLS causes operational lockout / incorrect isolation,
-- restore 015-style broad allowlist policies WITHOUT undoing:
--   - ownership columns / data (016)
--   - helpers / RPC hardening (017 / 018)
--   - indexes (019)
--   - NOT NULL / owner-aware unique (021) — leave as-is if already applied
--
-- WARN: This re-opens cross-teacher SELECT/WRITE on app tables (allowlist only).
-- WARN: Do NOT run casually. Review before executing in production.
-- This file is NOT applied by the Batch 3 agent request.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Drop Batch 3 ownership / shared policies (020 names)
-- ---------------------------------------------------------------------------
-- profiles
drop policy if exists "hub_owner_select_profiles" on public.profiles;
drop policy if exists "hub_owner_insert_profiles" on public.profiles;
drop policy if exists "hub_owner_update_profiles" on public.profiles;
drop policy if exists "hub_admin_delete_profiles" on public.profiles;

-- shared
drop policy if exists "hub_shared_select_terms" on public.terms;
drop policy if exists "hub_admin_insert_terms" on public.terms;
drop policy if exists "hub_admin_update_terms" on public.terms;
drop policy if exists "hub_admin_delete_terms" on public.terms;
drop policy if exists "hub_shared_select_levels" on public.levels;
drop policy if exists "hub_admin_insert_levels" on public.levels;
drop policy if exists "hub_admin_update_levels" on public.levels;
drop policy if exists "hub_admin_delete_levels" on public.levels;
drop policy if exists "hub_shared_select_tags" on public.tags;
drop policy if exists "hub_admin_insert_tags" on public.tags;
drop policy if exists "hub_admin_update_tags" on public.tags;
drop policy if exists "hub_admin_delete_tags" on public.tags;
drop policy if exists "hub_shared_select_context_tags" on public.context_tags;
drop policy if exists "hub_admin_insert_context_tags" on public.context_tags;
drop policy if exists "hub_admin_update_context_tags" on public.context_tags;
drop policy if exists "hub_admin_delete_context_tags" on public.context_tags;

-- students / classes / sch
drop policy if exists "hub_owner_select_students" on public.students;
drop policy if exists "hub_owner_insert_students" on public.students;
drop policy if exists "hub_owner_update_students" on public.students;
drop policy if exists "hub_owner_delete_students" on public.students;
drop policy if exists "hub_owner_select_classes" on public.classes;
drop policy if exists "hub_owner_insert_classes" on public.classes;
drop policy if exists "hub_owner_update_classes" on public.classes;
drop policy if exists "hub_owner_delete_classes" on public.classes;
drop policy if exists "hub_owner_select_sch" on public.student_class_history;
drop policy if exists "hub_owner_insert_sch" on public.student_class_history;
drop policy if exists "hub_owner_update_sch" on public.student_class_history;
drop policy if exists "hub_owner_delete_sch" on public.student_class_history;

-- direct student-scoped
drop policy if exists "hub_owner_select_focus" on public.current_focus_items;
drop policy if exists "hub_owner_insert_focus" on public.current_focus_items;
drop policy if exists "hub_owner_update_focus" on public.current_focus_items;
drop policy if exists "hub_owner_delete_focus" on public.current_focus_items;
drop policy if exists "hub_owner_select_records" on public.records;
drop policy if exists "hub_owner_insert_records" on public.records;
drop policy if exists "hub_owner_update_records" on public.records;
drop policy if exists "hub_owner_delete_records" on public.records;
drop policy if exists "hub_owner_select_parent_history" on public.parent_status_history;
drop policy if exists "hub_owner_insert_parent_history" on public.parent_status_history;
drop policy if exists "hub_owner_update_parent_history" on public.parent_status_history;
drop policy if exists "hub_owner_delete_parent_history" on public.parent_status_history;
drop policy if exists "hub_owner_select_cases" on public.cases;
drop policy if exists "hub_owner_insert_cases" on public.cases;
drop policy if exists "hub_owner_update_cases" on public.cases;
drop policy if exists "hub_owner_delete_cases" on public.cases;
drop policy if exists "hub_owner_select_student_voice" on public.student_voice_entries;
drop policy if exists "hub_owner_insert_student_voice" on public.student_voice_entries;
drop policy if exists "hub_owner_update_student_voice" on public.student_voice_entries;
drop policy if exists "hub_owner_delete_student_voice" on public.student_voice_entries;
drop policy if exists "hub_owner_select_working_hypotheses" on public.working_hypotheses;
drop policy if exists "hub_owner_insert_working_hypotheses" on public.working_hypotheses;
drop policy if exists "hub_owner_update_working_hypotheses" on public.working_hypotheses;
drop policy if exists "hub_owner_delete_working_hypotheses" on public.working_hypotheses;
drop policy if exists "hub_owner_select_interventions" on public.interventions;
drop policy if exists "hub_owner_insert_interventions" on public.interventions;
drop policy if exists "hub_owner_update_interventions" on public.interventions;
drop policy if exists "hub_owner_delete_interventions" on public.interventions;
drop policy if exists "hub_owner_select_abc_observations" on public.abc_observations;
drop policy if exists "hub_owner_insert_abc_observations" on public.abc_observations;
drop policy if exists "hub_owner_update_abc_observations" on public.abc_observations;
drop policy if exists "hub_owner_delete_abc_observations" on public.abc_observations;
drop policy if exists "hub_owner_select_consultation_notes" on public.consultation_notes;
drop policy if exists "hub_owner_insert_consultation_notes" on public.consultation_notes;
drop policy if exists "hub_owner_update_consultation_notes" on public.consultation_notes;
drop policy if exists "hub_owner_delete_consultation_notes" on public.consultation_notes;

-- junctions
drop policy if exists "hub_owner_select_record_tags" on public.record_tags;
drop policy if exists "hub_owner_insert_record_tags" on public.record_tags;
drop policy if exists "hub_owner_update_record_tags" on public.record_tags;
drop policy if exists "hub_owner_delete_record_tags" on public.record_tags;
drop policy if exists "hub_owner_select_followups" on public.followups;
drop policy if exists "hub_owner_insert_followups" on public.followups;
drop policy if exists "hub_owner_update_followups" on public.followups;
drop policy if exists "hub_owner_delete_followups" on public.followups;
drop policy if exists "hub_owner_select_record_context_tags" on public.record_context_tags;
drop policy if exists "hub_owner_insert_record_context_tags" on public.record_context_tags;
drop policy if exists "hub_owner_update_record_context_tags" on public.record_context_tags;
drop policy if exists "hub_owner_delete_record_context_tags" on public.record_context_tags;
drop policy if exists "hub_owner_select_case_records" on public.case_records;
drop policy if exists "hub_owner_insert_case_records" on public.case_records;
drop policy if exists "hub_owner_update_case_records" on public.case_records;
drop policy if exists "hub_owner_delete_case_records" on public.case_records;
drop policy if exists "hub_owner_select_hypothesis_records" on public.hypothesis_records;
drop policy if exists "hub_owner_insert_hypothesis_records" on public.hypothesis_records;
drop policy if exists "hub_owner_update_hypothesis_records" on public.hypothesis_records;
drop policy if exists "hub_owner_delete_hypothesis_records" on public.hypothesis_records;
drop policy if exists "hub_owner_select_intervention_responses" on public.intervention_responses;
drop policy if exists "hub_owner_insert_intervention_responses" on public.intervention_responses;
drop policy if exists "hub_owner_update_intervention_responses" on public.intervention_responses;
drop policy if exists "hub_owner_delete_intervention_responses" on public.intervention_responses;
drop policy if exists "hub_owner_select_hypothesis_interventions" on public.hypothesis_interventions;
drop policy if exists "hub_owner_insert_hypothesis_interventions" on public.hypothesis_interventions;
drop policy if exists "hub_owner_update_hypothesis_interventions" on public.hypothesis_interventions;
drop policy if exists "hub_owner_delete_hypothesis_interventions" on public.hypothesis_interventions;

-- review / notes / messages
drop policy if exists "hub_owner_select_review_actions" on public.review_actions;
drop policy if exists "hub_owner_insert_review_actions" on public.review_actions;
drop policy if exists "hub_owner_update_review_actions" on public.review_actions;
drop policy if exists "hub_owner_delete_review_actions" on public.review_actions;
drop policy if exists "hub_owner_select_work_notes" on public.work_notes;
drop policy if exists "hub_owner_insert_work_notes" on public.work_notes;
drop policy if exists "hub_owner_update_work_notes" on public.work_notes;
drop policy if exists "hub_owner_delete_work_notes" on public.work_notes;
drop policy if exists "hub_owner_select_work_note_students" on public.work_note_students;
drop policy if exists "hub_owner_insert_work_note_students" on public.work_note_students;
drop policy if exists "hub_owner_update_work_note_students" on public.work_note_students;
drop policy if exists "hub_owner_delete_work_note_students" on public.work_note_students;
drop policy if exists "hub_owner_select_work_note_classes" on public.work_note_classes;
drop policy if exists "hub_owner_insert_work_note_classes" on public.work_note_classes;
drop policy if exists "hub_owner_update_work_note_classes" on public.work_note_classes;
drop policy if exists "hub_owner_delete_work_note_classes" on public.work_note_classes;
drop policy if exists "hub_owner_select_work_followups" on public.work_followups;
drop policy if exists "hub_owner_insert_work_followups" on public.work_followups;
drop policy if exists "hub_owner_update_work_followups" on public.work_followups;
drop policy if exists "hub_owner_delete_work_followups" on public.work_followups;
drop policy if exists "hub_owner_select_messages" on public.messages;
drop policy if exists "hub_owner_insert_messages" on public.messages;
drop policy if exists "hub_owner_update_messages" on public.messages;
drop policy if exists "hub_owner_delete_messages" on public.messages;
drop policy if exists "hub_owner_select_message_targets" on public.message_targets;
drop policy if exists "hub_owner_insert_message_targets" on public.message_targets;
drop policy if exists "hub_owner_update_message_targets" on public.message_targets;
drop policy if exists "hub_owner_delete_message_targets" on public.message_targets;

-- ---------------------------------------------------------------------------
-- Restore 015-style broad allowlist policies
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
-- Optional: drop 020-only helpers (017/018 helpers KEEP)
-- Leave helpers in place by default so re-applying 020 is easier.
-- Uncomment only if you must remove them:
--
-- drop function if exists public.can_select_class(uuid);
-- drop function if exists public.owns_work_note(uuid);
-- drop function if exists public.owns_message(uuid);
-- drop function if exists public.owns_record(uuid);
-- drop function if exists public.owns_intervention(uuid);
-- drop function if exists public.case_record_link_allowed(uuid, uuid);
-- drop function if exists public.hypothesis_record_link_allowed(uuid, uuid);
-- drop function if exists public.hypothesis_intervention_link_allowed(uuid, uuid);
-- drop function if exists public.message_target_allowed(text, uuid, uuid);
-- ---------------------------------------------------------------------------

commit;
