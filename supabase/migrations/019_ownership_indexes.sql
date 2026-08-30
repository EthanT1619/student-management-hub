-- 019_ownership_indexes.sql
-- Batch 3 Step 1: Ownership column indexes ONLY.
-- Depends on: 016 (owner_id columns). Safe before/after 017–018.
--
-- Does NOT change RLS, unique indexes, or NOT NULL.
--
-- Index rationale:
--   - RLS / app filters frequently filter by owner_id on owned roots.
--   - owns_student / owns_class helpers look up by primary key (id) then compare
--     owner_id; students.id / classes.id already have PK indexes — no (id, owner_id)
--     composite index added.
--   - Child tables already have student_id / record_id / … indexes from 001–012.

create index if not exists students_owner_id_idx
  on public.students (owner_id);

create index if not exists classes_owner_id_idx
  on public.classes (owner_id);

create index if not exists work_notes_owner_id_idx
  on public.work_notes (owner_id);

create index if not exists messages_owner_id_idx
  on public.messages (owner_id);

comment on index public.students_owner_id_idx is
  'Batch 3: support ownership RLS / owner-scoped listings on students.';
comment on index public.classes_owner_id_idx is
  'Batch 3: support ownership RLS / owner-scoped listings on classes.';
comment on index public.work_notes_owner_id_idx is
  'Batch 3: support teacher-private Work Notes RLS.';
comment on index public.messages_owner_id_idx is
  'Batch 3: support teacher-private Messages RLS.';
