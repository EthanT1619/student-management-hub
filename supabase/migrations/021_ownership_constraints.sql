-- 021_ownership_constraints.sql
-- Batch 3 Step 3: owner_id NOT NULL + owner-aware class unique.
-- Depends on: 016 (columns), 020 (RLS cutover recommended first).
-- Independent of 020 for file rollback: do NOT apply 021 if 020 smoke fails.
--
-- Does NOT backfill owner_id. NULL rows abort the migration.
-- Does NOT change FK delete action (remain non-cascade).
-- Does NOT recreate class rows / change class ids.
--
-- Explicit transaction: fail-fast checks, NOT NULL, unique DROP/CREATE are atomic.

begin;

-- ---------------------------------------------------------------------------
-- Fail-fast: no NULL owners
-- ---------------------------------------------------------------------------
do $$
declare
  v_students int;
  v_classes int;
  v_notes int;
  v_messages int;
begin
  select count(*) into v_students from public.students where owner_id is null;
  select count(*) into v_classes from public.classes where owner_id is null;
  select count(*) into v_notes from public.work_notes where owner_id is null;
  select count(*) into v_messages from public.messages where owner_id is null;

  if v_students > 0 or v_classes > 0 or v_notes > 0 or v_messages > 0 then
    raise exception
      '021 abort: NULL owner_id present (students=%, classes=%, work_notes=%, messages=%). Fix backfill before NOT NULL.',
      v_students, v_classes, v_notes, v_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fail-fast: new unique key must not collide on existing rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_dups int;
begin
  select count(*) into v_dups
  from (
    select 1
    from public.classes
    group by owner_id, term_id, level_id, days_code, period
    having count(*) > 1
  ) d;

  if v_dups > 0 then
    raise exception
      '021 abort: % duplicate group(s) on (owner_id, term_id, level_id, days_code, period). Resolve before unique swap.',
      v_dups;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- NOT NULL
-- ---------------------------------------------------------------------------
alter table public.students
  alter column owner_id set not null;

alter table public.classes
  alter column owner_id set not null;

alter table public.work_notes
  alter column owner_id set not null;

alter table public.messages
  alter column owner_id set not null;

comment on column public.students.owner_id is
  'Teacher/admin who owns this student (longitudinal root). NOT NULL as of Batch 3 / 021.';
comment on column public.classes.owner_id is
  'Teacher/admin who owns this class. NOT NULL as of Batch 3 / 021.';
comment on column public.work_notes.owner_id is
  'Authorization owner for Work Notes. NOT NULL as of Batch 3 / 021. created_by remains audit-only.';
comment on column public.messages.owner_id is
  'Authorization owner for Message Archive. NOT NULL as of Batch 3 / 021. created_by remains audit-only.';

-- ---------------------------------------------------------------------------
-- Class unique: old → owner-aware
-- ---------------------------------------------------------------------------
drop index if exists public.classes_term_level_days_period_uidx;

create unique index public.classes_owner_term_level_days_period_uidx
  on public.classes (owner_id, term_id, level_id, days_code, period);

comment on index public.classes_owner_term_level_days_period_uidx is
  'Batch 3: teachers may share term/level/days/period; uniqueness is per owner.';

commit;
