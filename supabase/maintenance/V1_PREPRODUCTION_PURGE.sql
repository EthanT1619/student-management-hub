-- =============================================================================
-- Student Hub v1.0 — Pre-Production Operational Data Purge
-- =============================================================================
--
-- THIS SCRIPT IS DESTRUCTIVE.
-- RUN ONLY BEFORE FIRST PRODUCTION DATA ENTRY.
--
-- Purpose:
--   Delete QA / test operational rows so production can start from a clean
--   baseline. Does NOT reset schema, RLS, RPC, triggers, or Auth.
--
-- Location:
--   supabase/maintenance/V1_PREPRODUCTION_PURGE.sql
--   (NOT a migration — do not place under supabase/migrations/)
--
-- NEVER:
--   DROP TABLE / DROP SCHEMA / db reset
--   DELETE FROM auth.users
--   DELETE FROM allowed_student_hub_users / tags / context_tags / levels
--   Change RLS, RPC, policies, or migrations 001–015
--
-- HOW TO RUN (Supabase SQL Editor):
--   1) Run STEP 1 (counts) and review row numbers.
--   2) Choose Option B or Option A (see comments).
--   3) Uncomment ONLY that option's BEGIN…COMMIT block and run it once.
--   4) Run STEP 3 (verification).
--
-- Table classification (from migrations 001–015 + seed):
--
--   KEEP (system / master / security / auth-linked profile):
--     allowed_student_hub_users
--     tags
--     context_tags
--     levels
--     profiles              -- created by auth trigger; do not purge
--
--   DECISION (roster structure — not auto-purged):
--     terms
--     classes              -- FK → terms, levels (levels KEEP)
--
--   PURGE (operational / QA data):
--     students
--     student_class_history
--     parent_status_history
--     current_focus_items
--     records              -- includes stamp_* columns (no separate stamps table)
--     record_tags
--     followups
--     review_actions
--     messages
--     message_targets
--     work_notes
--     work_note_students
--     work_note_classes
--     work_followups
--     cases
--     case_records
--     student_voice_entries
--     working_hypotheses
--     hypothesis_records
--     interventions
--     intervention_responses
--     abc_observations
--     record_context_tags
--     hypothesis_interventions
--     consultation_notes
--
-- Truncate strategy:
--   Single TRUNCATE listing every PURGE table (and terms/classes for Option A).
--   NO CASCADE — avoids accidentally pulling KEEP tables into the truncate set.
--   All FK children that reference purge parents are listed explicitly.
--
-- =============================================================================


-- =============================================================================
-- STEP 1 — DRY-RUN / BEFORE COUNTS (safe; run anytime)
-- =============================================================================

select * from (
  select 1 as ord, 'PURGE'::text as bucket, 'students'::text as table_name, count(*)::bigint as row_count from public.students
  union all select 2, 'PURGE', 'student_class_history', count(*) from public.student_class_history
  union all select 3, 'PURGE', 'parent_status_history', count(*) from public.parent_status_history
  union all select 4, 'PURGE', 'current_focus_items', count(*) from public.current_focus_items
  union all select 5, 'PURGE', 'records', count(*) from public.records
  union all select 6, 'PURGE', 'record_tags', count(*) from public.record_tags
  union all select 7, 'PURGE', 'followups', count(*) from public.followups
  union all select 8, 'PURGE', 'review_actions', count(*) from public.review_actions
  union all select 9, 'PURGE', 'messages', count(*) from public.messages
  union all select 10, 'PURGE', 'message_targets', count(*) from public.message_targets
  union all select 11, 'PURGE', 'work_notes', count(*) from public.work_notes
  union all select 12, 'PURGE', 'work_note_students', count(*) from public.work_note_students
  union all select 13, 'PURGE', 'work_note_classes', count(*) from public.work_note_classes
  union all select 14, 'PURGE', 'work_followups', count(*) from public.work_followups
  union all select 15, 'PURGE', 'cases', count(*) from public.cases
  union all select 16, 'PURGE', 'case_records', count(*) from public.case_records
  union all select 17, 'PURGE', 'student_voice_entries', count(*) from public.student_voice_entries
  union all select 18, 'PURGE', 'working_hypotheses', count(*) from public.working_hypotheses
  union all select 19, 'PURGE', 'hypothesis_records', count(*) from public.hypothesis_records
  union all select 20, 'PURGE', 'interventions', count(*) from public.interventions
  union all select 21, 'PURGE', 'intervention_responses', count(*) from public.intervention_responses
  union all select 22, 'PURGE', 'abc_observations', count(*) from public.abc_observations
  union all select 23, 'PURGE', 'record_context_tags', count(*) from public.record_context_tags
  union all select 24, 'PURGE', 'hypothesis_interventions', count(*) from public.hypothesis_interventions
  union all select 25, 'PURGE', 'consultation_notes', count(*) from public.consultation_notes
  union all select 26, 'DECISION', 'terms', count(*) from public.terms
  union all select 27, 'DECISION', 'classes', count(*) from public.classes
  union all select 28, 'KEEP', 'allowed_student_hub_users', count(*) from public.allowed_student_hub_users
  union all select 29, 'KEEP', 'tags', count(*) from public.tags
  union all select 30, 'KEEP', 'context_tags', count(*) from public.context_tags
  union all select 31, 'KEEP', 'levels', count(*) from public.levels
  union all select 32, 'KEEP', 'profiles', count(*) from public.profiles
) c
order by ord;


-- =============================================================================
-- STEP 2 — PURGE (DESTRUCTIVE)
-- Uncomment EXACTLY ONE option. Do not run both.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OPTION B — Keep terms + classes; purge students and all operational data
-- Use when current Term/Class shell should remain for production roster entry.
-- Effect:
--   - All students and linked history/records/cases/deep-tracking gone
--   - Messages / work notes gone (including class-linked targets)
--   - terms / classes / levels / tags / allowlist / profiles remain
-- -----------------------------------------------------------------------------

/*
BEGIN;

TRUNCATE TABLE
  public.hypothesis_interventions,
  public.intervention_responses,
  public.hypothesis_records,
  public.record_context_tags,
  public.abc_observations,
  public.case_records,
  public.student_voice_entries,
  public.working_hypotheses,
  public.interventions,
  public.consultation_notes,
  public.cases,
  public.work_followups,
  public.work_note_students,
  public.work_note_classes,
  public.work_notes,
  public.message_targets,
  public.messages,
  public.review_actions,
  public.followups,
  public.record_tags,
  public.records,
  public.current_focus_items,
  public.parent_status_history,
  public.student_class_history,
  public.students;

COMMIT;
*/


-- -----------------------------------------------------------------------------
-- OPTION A — Also delete terms + classes (full roster baseline reset)
-- Use only if test Terms/Classes should not carry into production.
-- Effect:
--   - Everything in Option B, plus terms and classes emptied
--   - levels / tags / context_tags / allowlist / profiles still KEEP
--   - You will recreate Term + Classes before adding real students
-- Requires the same operational tables as B in one TRUNCATE (FK-safe, no CASCADE).
-- -----------------------------------------------------------------------------

/*
BEGIN;

TRUNCATE TABLE
  public.hypothesis_interventions,
  public.intervention_responses,
  public.hypothesis_records,
  public.record_context_tags,
  public.abc_observations,
  public.case_records,
  public.student_voice_entries,
  public.working_hypotheses,
  public.interventions,
  public.consultation_notes,
  public.cases,
  public.work_followups,
  public.work_note_students,
  public.work_note_classes,
  public.work_notes,
  public.message_targets,
  public.messages,
  public.review_actions,
  public.followups,
  public.record_tags,
  public.records,
  public.current_focus_items,
  public.parent_status_history,
  public.student_class_history,
  public.students,
  public.classes,
  public.terms;

COMMIT;
*/


-- =============================================================================
-- STEP 3 — AFTER VERIFICATION
-- =============================================================================

-- 3a) Operational tables should be 0
select * from (
  select 'students'::text as table_name, count(*)::bigint as row_count from public.students
  union all select 'student_class_history', count(*) from public.student_class_history
  union all select 'parent_status_history', count(*) from public.parent_status_history
  union all select 'current_focus_items', count(*) from public.current_focus_items
  union all select 'records', count(*) from public.records
  union all select 'record_tags', count(*) from public.record_tags
  union all select 'followups', count(*) from public.followups
  union all select 'review_actions', count(*) from public.review_actions
  union all select 'messages', count(*) from public.messages
  union all select 'message_targets', count(*) from public.message_targets
  union all select 'work_notes', count(*) from public.work_notes
  union all select 'work_note_students', count(*) from public.work_note_students
  union all select 'work_note_classes', count(*) from public.work_note_classes
  union all select 'work_followups', count(*) from public.work_followups
  union all select 'cases', count(*) from public.cases
  union all select 'case_records', count(*) from public.case_records
  union all select 'student_voice_entries', count(*) from public.student_voice_entries
  union all select 'working_hypotheses', count(*) from public.working_hypotheses
  union all select 'hypothesis_records', count(*) from public.hypothesis_records
  union all select 'interventions', count(*) from public.interventions
  union all select 'intervention_responses', count(*) from public.intervention_responses
  union all select 'abc_observations', count(*) from public.abc_observations
  union all select 'record_context_tags', count(*) from public.record_context_tags
  union all select 'hypothesis_interventions', count(*) from public.hypothesis_interventions
  union all select 'consultation_notes', count(*) from public.consultation_notes
) v
order by table_name;

-- 3b) KEEP masters / security must remain (>0 expected for seeded masters)
select
  (select count(*) from public.allowed_student_hub_users) as allowlist_rows,
  (select count(*) from public.tags) as tags_rows,
  (select count(*) from public.context_tags) as context_tags_rows,
  (select count(*) from public.levels) as levels_rows,
  (select count(*) from public.profiles) as profiles_rows;

-- 3c) DECISION tables — Option B: may be >0; Option A: both must be 0
select
  (select count(*) from public.terms) as terms_rows,
  (select count(*) from public.classes) as classes_rows,
  (select count(*) filter (where is_current) from public.terms) as current_term_rows;

-- 3d) Schema / security objects still present (expect true)
select
  to_regclass('public.allowed_student_hub_users') is not null as has_allowlist_table,
  to_regprocedure('public.is_student_hub_user()') is not null as has_is_student_hub_user,
  to_regprocedure('public.assert_student_hub_user()') is not null as has_assert_student_hub_user,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_student'
  ) as has_create_student_rpc,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'students'
  ) as has_students_rls_policy;

-- 3e) auth.users untouched check (read-only count; do not DELETE)
-- Requires permission to read auth schema in SQL Editor (usually available to project owner).
select count(*) as auth_users_count from auth.users;
