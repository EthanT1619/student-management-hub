-- 016_ownership_columns.sql
-- Batch 1: Additive ownership / role columns ONLY.
-- Does NOT change RLS, RPC, class unique indexes, or NOT NULL on owner_id.
-- Does NOT backfill owner_id (see supabase/maintenance/V1_OWNERSHIP_BACKFILL.sql).
--
-- After applying this migration, existing Hub behavior must remain unchanged
-- (broad allowlist RLS still applies; nullable owner_id ignored by app).

-- ---------------------------------------------------------------------------
-- allowed_student_hub_users.role
-- ---------------------------------------------------------------------------
alter table public.allowed_student_hub_users
  add column if not exists role text;

-- Complete NOT NULL safely if column already existed as nullable (no-op when filled)
update public.allowed_student_hub_users
set role = 'teacher'
where role is null;

alter table public.allowed_student_hub_users
  alter column role set default 'teacher';

alter table public.allowed_student_hub_users
  alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allowed_student_hub_users_role_check'
      and conrelid = 'public.allowed_student_hub_users'::regclass
  ) then
    alter table public.allowed_student_hub_users
      add constraint allowed_student_hub_users_role_check
      check (role in ('admin', 'teacher'));
  end if;
end $$;

comment on column public.allowed_student_hub_users.role is
  'Hub ACL role: admin | teacher. Managed via SQL Editor only (no client policies). Batch 1 default = teacher; promote admin via V1_OWNERSHIP_BACKFILL.sql only.';

-- ---------------------------------------------------------------------------
-- students.owner_id (nullable — Batch 1)
-- ON DELETE: no cascade (ownership must not wipe longitudinal data if auth user removed)
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_owner_id_fkey'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_owner_id_fkey
      foreign key (owner_id) references auth.users (id);
  end if;
end $$;

comment on column public.students.owner_id is
  'Teacher/admin who owns this student (longitudinal root). Nullable until ownership backfill + later NOT NULL.';

-- ---------------------------------------------------------------------------
-- classes.owner_id (nullable — Batch 1)
-- Class unique (term, level, days, period) intentionally UNCHANGED in this batch.
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_owner_id_fkey'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_owner_id_fkey
      foreign key (owner_id) references auth.users (id);
  end if;
end $$;

comment on column public.classes.owner_id is
  'Teacher/admin who owns this class. Nullable until ownership backfill + later NOT NULL.';

-- ---------------------------------------------------------------------------
-- work_notes.owner_id (nullable — Batch 1)
-- created_by remains audit metadata; do not drop or alter it.
-- ---------------------------------------------------------------------------
alter table public.work_notes
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_notes_owner_id_fkey'
      and conrelid = 'public.work_notes'::regclass
  ) then
    alter table public.work_notes
      add constraint work_notes_owner_id_fkey
      foreign key (owner_id) references auth.users (id);
  end if;
end $$;

comment on column public.work_notes.owner_id is
  'Authorization owner for Work Notes. created_by is audit-only and must remain.';

-- ---------------------------------------------------------------------------
-- messages.owner_id (nullable — Batch 1)
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_owner_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_owner_id_fkey
      foreign key (owner_id) references auth.users (id);
  end if;
end $$;

comment on column public.messages.owner_id is
  'Authorization owner for Message Archive. created_by is audit-only and must remain.';
