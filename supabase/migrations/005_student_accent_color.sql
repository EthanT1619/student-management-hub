-- 005_student_accent_color.sql
-- Optional per-student accent for Calendar / list indicators (tracking aid only).

alter table public.students
  add column if not exists accent_color text
  check (
    accent_color is null
    or accent_color in (
      'blue', 'purple', 'orange', 'red', 'teal', 'yellow', 'pink', 'gray'
    )
  );
