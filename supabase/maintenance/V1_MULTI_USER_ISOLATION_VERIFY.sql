-- =============================================================================
-- Student Hub — Multi-User Isolation VERIFY (READ-ONLY)
-- File: supabase/maintenance/V1_MULTI_USER_ISOLATION_VERIFY.sql
--
-- Run AFTER applying 019 + 020 (+ 021 when ready).
-- Does NOT INSERT / UPDATE / DELETE.
--
-- Preservation count comments (Batch 3 planning baseline; NOT hard assertions):
--   students ~38, classes ~5, records ~11, current_focus_items ~22,
--   cases ~0, work_notes ~0, messages ~3
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Schema: NOT NULL + FK + indexes + unique
-- ---------------------------------------------------------------------------
select
  c.table_name,
  c.column_name,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.column_name = 'owner_id'
  and c.table_name in ('students', 'classes', 'work_notes', 'messages')
order by c.table_name;
-- Expect after 021: is_nullable = 'NO' for all four.

select
  con.conname,
  con.conrelid::regclass as table_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.contype = 'f'
  and con.conname in (
    'students_owner_id_fkey',
    'classes_owner_id_fkey',
    'work_notes_owner_id_fkey',
    'messages_owner_id_fkey'
  )
order by con.conname;
-- Expect ON DELETE NO ACTION / RESTRICT style (no CASCADE on owner_id).

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and (
    indexname in (
      'students_owner_id_idx',
      'classes_owner_id_idx',
      'work_notes_owner_id_idx',
      'messages_owner_id_idx',
      'classes_owner_term_level_days_period_uidx',
      'classes_term_level_days_period_uidx'
    )
  )
order by indexname;
-- After 021: owner-aware unique present; old classes_term_level_days_period_uidx ABSENT.

-- ---------------------------------------------------------------------------
-- 2) Policy inventory + broad residual count
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select count(*) as hub_user_all_remaining
from pg_policies
where schemaname = 'public'
  and policyname like 'hub_user_all_%';
-- Expect 0 after 020.

select count(*) as hub_user_own_review_remaining
from pg_policies
where schemaname = 'public'
  and policyname = 'hub_user_own_review_actions';
-- Expect 0 after 020 (replaced by hub_owner_*_review_actions).

-- ---------------------------------------------------------------------------
-- 3) Owner integrity
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.students where owner_id is null) as students_null_owners,
  (select count(*) from public.classes where owner_id is null) as classes_null_owners,
  (select count(*) from public.work_notes where owner_id is null) as work_notes_null_owners,
  (select count(*) from public.messages where owner_id is null) as messages_null_owners;
-- Expect all 0 (after backfill; required before/after 021).

select
  'students' as tbl, count(*) as orphan_auth_owners
from public.students s
where s.owner_id is not null
  and not exists (select 1 from auth.users u where u.id = s.owner_id)
union all
select 'classes', count(*)
from public.classes c
where c.owner_id is not null
  and not exists (select 1 from auth.users u where u.id = c.owner_id)
union all
select 'work_notes', count(*)
from public.work_notes w
where w.owner_id is not null
  and not exists (select 1 from auth.users u where u.id = w.owner_id)
union all
select 'messages', count(*)
from public.messages m
where m.owner_id is not null
  and not exists (select 1 from auth.users u where u.id = m.owner_id);

-- Owners not on active allowlist (all four owned roots)
select
  'students' as tbl, count(*) as non_active_hub_owners
from public.students s
join auth.users u on u.id = s.owner_id
where not exists (
  select 1 from public.allowed_student_hub_users a
  where a.is_active = true and lower(a.email) = lower(u.email)
)
union all
select 'classes', count(*)
from public.classes c
join auth.users u on u.id = c.owner_id
where not exists (
  select 1 from public.allowed_student_hub_users a
  where a.is_active = true and lower(a.email) = lower(u.email)
)
union all
select 'work_notes', count(*)
from public.work_notes w
join auth.users u on u.id = w.owner_id
where not exists (
  select 1 from public.allowed_student_hub_users a
  where a.is_active = true and lower(a.email) = lower(u.email)
)
union all
select 'messages', count(*)
from public.messages m
join auth.users u on u.id = m.owner_id
where not exists (
  select 1 from public.allowed_student_hub_users a
  where a.is_active = true and lower(a.email) = lower(u.email)
);
-- Expect 0 for each

-- ---------------------------------------------------------------------------
-- 3b) Cross-student relational integrity (READ-ONLY mismatch counts)
-- ---------------------------------------------------------------------------
select
  (select count(*)
   from public.case_records cr
   join public.cases c on c.id = cr.case_id
   join public.records r on r.id = cr.record_id
   where c.student_id is distinct from r.student_id
  ) as case_records_student_mismatch,
  (select count(*)
   from public.hypothesis_records hr
   join public.working_hypotheses h on h.id = hr.hypothesis_id
   join public.records r on r.id = hr.record_id
   where h.student_id is distinct from r.student_id
  ) as hypothesis_records_student_mismatch,
  (select count(*)
   from public.hypothesis_interventions hi
   join public.working_hypotheses h on h.id = hi.hypothesis_id
   join public.interventions i on i.id = hi.intervention_id
   where h.student_id is distinct from i.student_id
  ) as hypothesis_interventions_student_mismatch,
  (select count(*)
   from public.abc_observations abc
   join public.records r on r.id = abc.record_id
   where abc.record_id is not null
     and abc.student_id is distinct from r.student_id
  ) as abc_observations_student_mismatch;
-- Expect all 0

-- ---------------------------------------------------------------------------
-- 4) Roles
-- ---------------------------------------------------------------------------
select role, count(*) as n, count(*) filter (where is_active) as active_n
from public.allowed_student_hub_users
group by role
order by role;

select count(*) as invalid_roles
from public.allowed_student_hub_users
where role is null or role not in ('admin', 'teacher');

select count(*) as active_admins
from public.allowed_student_hub_users
where is_active and role = 'admin';
-- Expect active_admins >= 1

-- ---------------------------------------------------------------------------
-- 5) Preservation counts (informational)
-- ---------------------------------------------------------------------------
select 'students' as tbl, count(*) as n from public.students
union all select 'classes', count(*) from public.classes
union all select 'records', count(*) from public.records
union all select 'current_focus_items', count(*) from public.current_focus_items
union all select 'cases', count(*) from public.cases
union all select 'work_notes', count(*) from public.work_notes
union all select 'messages', count(*) from public.messages
union all select 'student_class_history', count(*) from public.student_class_history
union all select 'terms', count(*) from public.terms
union all select 'levels', count(*) from public.levels
order by tbl;

-- ---------------------------------------------------------------------------
-- 6) Class unique duplicate readiness (owner-aware key)
-- ---------------------------------------------------------------------------
select owner_id, term_id, level_id, days_code, period, count(*) as n
from public.classes
group by owner_id, term_id, level_id, days_code, period
having count(*) > 1;
-- Expect 0 rows

-- ---------------------------------------------------------------------------
-- 7) SECURITY DEFINER spot-check (helpers / hardened RPCs)
-- ---------------------------------------------------------------------------
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_student_hub_user',
    'is_student_hub_admin',
    'owns_student',
    'owns_class',
    'can_select_class',
    'owns_work_note',
    'owns_message',
    'owns_record',
    'create_student',
    'create_class',
    'ensure_level',
    'set_current_term'
  )
order by p.proname, args;
-- Expect: security_definer true; search_path in config; anon/public execute false; authenticated true.

-- =============================================================================
-- Manual cross-user smoke checklist (do NOT automate destructively in prod)
-- Use separate Teacher A / Teacher B / Admin browser sessions after 020.
--
-- Student
--   [ ] A lists only A students; cannot open B student by UUID (empty/null)
--   [ ] A cannot insert student with owner_id=B (RLS WITH CHECK fail)
--   [ ] A cannot UPDATE own student.owner_id → B
--
-- Child
--   [ ] A cannot select B records/focus/cases/...
--   [ ] A cannot insert record for B student_id
--   [ ] A cannot retarget own record.student_id → B
--
-- Class
--   [ ] A and B can each create same term+level+days+period AFTER 021 (different owners)
--   [ ] A cannot update/delete B class
--   [ ] A class list does not show B operational classes (except history metadata exception)
--
-- Shared
--   [ ] A/B SELECT terms/levels/tags/context_tags OK
--   [ ] Teacher direct INSERT/UPDATE terms fails; Admin succeeds
--
-- Private
--   [ ] A cannot read B work_notes / messages
--
-- Historical metadata
--   [ ] After hypothetical handover (manual owner_id change by admin SQL only):
--       B sees old class metadata on student history join
--       B does not see other students on that class roster
--       B cannot Edit/update that foreign class
--
-- RPC
--   [ ] Teacher ensure_level / set_current_term still denied (018)
--   [ ] create_student still forces owner_id = auth.uid()
-- =============================================================================
