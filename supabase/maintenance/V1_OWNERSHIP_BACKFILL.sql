-- =============================================================================
-- MANUAL PRODUCTION OPERATION
-- DO NOT RUN UNTIL ADMIN EMAIL / UID IS VERIFIED
-- =============================================================================
--
-- Student Hub v1.0 — Ownership backfill (Batch 1 companion)
-- File: supabase/maintenance/V1_OWNERSHIP_BACKFILL.sql
--
-- Prerequisites:
--   1) supabase/migrations/016_ownership_columns.sql applied in SQL Editor
--   2) You have verified the production admin Google email and auth.users.id
--
-- This script UPDATES ownership/role data. It is NOT a migration.
-- Do not run automatically. Do not leave placeholders in place.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0 — Replace placeholders (REQUIRED)
-- ---------------------------------------------------------------------------
-- Set BOTH values to the verified production admin identity.
-- Example:
--   admin_email := 'owner@example.com';
--   admin_uid   := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
--
-- Leave as __ADMIN_EMAIL__ / __ADMIN_UID__ and the script WILL abort.

do $$
declare
  admin_email text := '__ADMIN_EMAIL__';
  admin_uid   uuid;
  admin_uid_text text := '__ADMIN_UID__';
  matched_uid uuid;
  matched_email text;
  n bigint;
begin
  if admin_email is null
     or btrim(admin_email) = ''
     or admin_email like '%ADMIN_EMAIL%'
     or admin_uid_text is null
     or btrim(admin_uid_text) = ''
     or admin_uid_text like '%ADMIN_UID%'
  then
    raise exception
      'V1_OWNERSHIP_BACKFILL aborted: replace __ADMIN_EMAIL__ and __ADMIN_UID__ with verified values before running.';
  end if;

  begin
    admin_uid := admin_uid_text::uuid;
  exception
    when invalid_text_representation then
      raise exception
        'V1_OWNERSHIP_BACKFILL aborted: __ADMIN_UID__ is not a valid uuid: %',
        admin_uid_text;
  end;

  -- Confirm auth.users row
  select u.id, u.email
    into matched_uid, matched_email
  from auth.users u
  where u.id = admin_uid;

  if matched_uid is null then
    raise exception
      'V1_OWNERSHIP_BACKFILL aborted: admin_uid % not found in auth.users',
      admin_uid;
  end if;

  if lower(btrim(matched_email)) is distinct from lower(btrim(admin_email)) then
    raise exception
      'V1_OWNERSHIP_BACKFILL aborted: email mismatch. auth.users.email=% declared=%',
      matched_email, admin_email;
  end if;

  -- Confirm allowlist: exactly one ACTIVE row for this email
  select count(*) into n
  from public.allowed_student_hub_users a
  where lower(a.email) = lower(btrim(admin_email))
    and a.is_active = true;

  if n = 0 then
    if exists (
      select 1
      from public.allowed_student_hub_users a
      where lower(a.email) = lower(btrim(admin_email))
        and a.is_active is distinct from true
    ) then
      raise exception
        'V1_OWNERSHIP_BACKFILL aborted: email % exists in allowed_student_hub_users but is_active is not true. Reactivate before promoting to admin.',
        admin_email;
    end if;
    raise exception
      'V1_OWNERSHIP_BACKFILL aborted: email % has no active row in allowed_student_hub_users',
      admin_email;
  end if;

  if n <> 1 then
    raise exception
      'V1_OWNERSHIP_BACKFILL aborted: expected exactly 1 active allowlist row for email %, found %',
      admin_email, n;
  end if;

  raise notice 'V1_OWNERSHIP_BACKFILL: verified admin email=% uid=% (1 active allowlist row)', matched_email, admin_uid;

  -- -------------------------------------------------------------------------
  -- STEP 1 — Promote verified ACTIVE allowlist row to admin (exact email only)
  -- -------------------------------------------------------------------------
  update public.allowed_student_hub_users
  set role = 'admin'
  where lower(email) = lower(btrim(admin_email))
    and is_active = true;

  get diagnostics n = row_count;
  raise notice 'allowlist role=admin updated rows=%', n;

  -- -------------------------------------------------------------------------
  -- STEP 2 — students / classes: NULL owner_id only → verified admin
  -- -------------------------------------------------------------------------
  update public.students
  set owner_id = admin_uid
  where owner_id is null;

  get diagnostics n = row_count;
  raise notice 'students.owner_id backfilled rows=%', n;

  update public.classes
  set owner_id = admin_uid
  where owner_id is null;

  get diagnostics n = row_count;
  raise notice 'classes.owner_id backfilled rows=%', n;

  -- -------------------------------------------------------------------------
  -- STEP 3 — work_notes: prefer created_by when it is a real auth user
  -- -------------------------------------------------------------------------
  update public.work_notes w
  set owner_id = w.created_by
  where w.owner_id is null
    and w.created_by is not null
    and exists (select 1 from auth.users u where u.id = w.created_by);

  get diagnostics n = row_count;
  raise notice 'work_notes.owner_id from created_by rows=%', n;

  update public.work_notes
  set owner_id = admin_uid
  where owner_id is null;

  get diagnostics n = row_count;
  raise notice 'work_notes.owner_id admin fallback rows=%', n;

  -- -------------------------------------------------------------------------
  -- STEP 4 — messages: same as work_notes
  -- -------------------------------------------------------------------------
  update public.messages m
  set owner_id = m.created_by
  where m.owner_id is null
    and m.created_by is not null
    and exists (select 1 from auth.users u where u.id = m.created_by);

  get diagnostics n = row_count;
  raise notice 'messages.owner_id from created_by rows=%', n;

  update public.messages
  set owner_id = admin_uid
  where owner_id is null;

  get diagnostics n = row_count;
  raise notice 'messages.owner_id admin fallback rows=%', n;

  raise notice 'V1_OWNERSHIP_BACKFILL completed. Run V1_OWNERSHIP_VERIFY.sql next.';
end $$;
