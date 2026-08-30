-- =============================================================================
-- Student Hub — Ownership Batch 1 verification (READ-ONLY)
-- File: supabase/maintenance/V1_OWNERSHIP_VERIFY.sql
--
-- Does NOT INSERT / UPDATE / DELETE.
--
-- When to run:
--   - BEFORE migration 016: do NOT run this whole file (owner_id / role columns
--     do not exist yet). If you only need a baseline snapshot, run the
--     "Preservation counts" query block by itself (section 5 below).
--   - AFTER migration 016: this entire file is safe to run.
--   - AFTER backfill: re-run to confirm owner_null = 0 and non_active_hub_owners = 0.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Identity discovery helpers (read-only) — use AFTER 016, BEFORE editing BACKFILL
-- ---------------------------------------------------------------------------
-- Compare allowlist emails to auth.users (no password / secrets).
select
  a.email as allowlist_email,
  a.is_active,
  a.role as allowlist_role,
  a.note,
  u.id as auth_uid,
  u.email as auth_email,
  u.created_at as auth_created_at
from public.allowed_student_hub_users a
left join auth.users u on lower(u.email) = lower(a.email)
order by a.email;

-- ---------------------------------------------------------------------------
-- 1) Schema presence
-- ---------------------------------------------------------------------------
select
  to_regclass('public.allowed_student_hub_users') is not null as has_allowlist,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allowed_student_hub_users'
      and column_name = 'role'
  ) as has_allowlist_role,
  exists (
    select 1 from pg_constraint
    where conname = 'allowed_student_hub_users_role_check'
  ) as has_allowlist_role_check,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'owner_id'
  ) as has_students_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'owner_id'
  ) as has_classes_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_notes' and column_name = 'owner_id'
  ) as has_work_notes_owner_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'owner_id'
  ) as has_messages_owner_id;

-- FK targets (owner_id → auth.users)
select
  c.conname,
  c.conrelid::regclass as table_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.contype = 'f'
  and c.conname in (
    'students_owner_id_fkey',
    'classes_owner_id_fkey',
    'work_notes_owner_id_fkey',
    'messages_owner_id_fkey'
  )
order by c.conname;

-- Class unique must still be the OLD key in Batch 1 (no owner_id in unique yet)
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'classes'
  and indexname in (
    'classes_term_level_days_period_uidx',
    'classes_owner_term_level_days_period_uidx'
  )
order by indexname;

-- ---------------------------------------------------------------------------
-- 2) Ownership fill counts
-- ---------------------------------------------------------------------------
select * from (
  select 'students'::text as table_name,
    count(*)::bigint as total,
    count(*) filter (where owner_id is null)::bigint as owner_null,
    count(*) filter (where owner_id is not null)::bigint as owner_set
  from public.students
  union all
  select 'classes', count(*), count(*) filter (where owner_id is null), count(*) filter (where owner_id is not null)
  from public.classes
  union all
  select 'work_notes', count(*), count(*) filter (where owner_id is null), count(*) filter (where owner_id is not null)
  from public.work_notes
  union all
  select 'messages', count(*), count(*) filter (where owner_id is null), count(*) filter (where owner_id is not null)
  from public.messages
) c
order by table_name;

-- After successful backfill expect owner_null = 0 for all four.

-- ---------------------------------------------------------------------------
-- 3) Invalid owner_id (not in auth.users) — expect 0
-- ---------------------------------------------------------------------------
select * from (
  select 'students'::text as table_name, count(*)::bigint as orphan_owners
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
    and not exists (select 1 from auth.users u where u.id = m.owner_id)
) o
order by table_name;

-- ---------------------------------------------------------------------------
-- 3b) owner_id in auth.users but NOT linked to an ACTIVE allowlist email
--     (NULL owner_id excluded — counted in section 2)
--     Expect 0 for all four after a correct backfill.
-- ---------------------------------------------------------------------------
select * from (
  select 'students'::text as table_name, count(*)::bigint as non_active_hub_owners
  from public.students s
  join auth.users u on u.id = s.owner_id
  where s.owner_id is not null
    and not exists (
      select 1
      from public.allowed_student_hub_users a
      where a.is_active = true
        and lower(a.email) = lower(u.email)
    )
  union all
  select 'classes', count(*)
  from public.classes c
  join auth.users u on u.id = c.owner_id
  where c.owner_id is not null
    and not exists (
      select 1
      from public.allowed_student_hub_users a
      where a.is_active = true
        and lower(a.email) = lower(u.email)
    )
  union all
  select 'work_notes', count(*)
  from public.work_notes w
  join auth.users u on u.id = w.owner_id
  where w.owner_id is not null
    and not exists (
      select 1
      from public.allowed_student_hub_users a
      where a.is_active = true
        and lower(a.email) = lower(u.email)
    )
  union all
  select 'messages', count(*)
  from public.messages m
  join auth.users u on u.id = m.owner_id
  where m.owner_id is not null
    and not exists (
      select 1
      from public.allowed_student_hub_users a
      where a.is_active = true
        and lower(a.email) = lower(u.email)
    )
) na
order by table_name;

-- ---------------------------------------------------------------------------
-- 4) Allowlist roles
-- ---------------------------------------------------------------------------
select email, is_active, role, note, created_at
from public.allowed_student_hub_users
order by email;

select count(*)::bigint as invalid_role_rows
from public.allowed_student_hub_users
where role is null or role not in ('admin', 'teacher');

-- ---------------------------------------------------------------------------
-- 5) Preservation counts (compare before/after Batch 1 manually)
-- ---------------------------------------------------------------------------
-- This block alone may be copied and run BEFORE migration 016 as a baseline
-- snapshot (it does not reference owner_id / role). The rest of this file
-- requires 016.
select * from (
  select 'students'::text as table_name, count(*)::bigint as row_count from public.students
  union all select 'classes', count(*) from public.classes
  union all select 'records', count(*) from public.records
  union all select 'current_focus_items', count(*) from public.current_focus_items
  union all select 'cases', count(*) from public.cases
  union all select 'work_notes', count(*) from public.work_notes
  union all select 'messages', count(*) from public.messages
) p
order by table_name;

-- ---------------------------------------------------------------------------
-- 6) Batch 1 safety: RLS policy names still include hub_user_all (spot check)
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('students', 'classes', 'work_notes', 'messages', 'records')
order by tablename, policyname;
