-- 002_class_structure.sql
-- Level / Class 분리. Source of Truth = classes (level + days_code + period)
-- students.class_id 만으로 반 소속. students.level / class_days / period 제거.
-- 기존 students / records / followups 등 데이터는 보존.

-- ---------------------------------------------------------------------------
-- levels (master)
-- ---------------------------------------------------------------------------
create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_levels_updated
  before update on public.levels
  for each row execute function public.set_updated_at();

alter table public.levels enable row level security;

drop policy if exists "authenticated_all_levels" on public.levels;
create policy "authenticated_all_levels" on public.levels
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- classes: add structured columns (keep name temporarily for backfill)
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists level_id uuid references public.levels (id) on delete restrict,
  add column if not exists days_code text,
  add column if not exists period text;

-- ---------------------------------------------------------------------------
-- Helper: normalize freeform day tokens → days_code
-- ---------------------------------------------------------------------------
create or replace function public.normalize_days_code(p_days text[])
returns text
language plpgsql
immutable
as $$
declare
  v text[] := array[]::text[];
  d text;
  tok text;
begin
  if p_days is null or cardinality(p_days) = 0 then
    return 'UNSET';
  end if;

  foreach d in array p_days loop
    tok := lower(trim(d));
    if tok in ('mon', 'monday', '월', '월요', '월요일') then
      v := array_append(v, 'Mon');
    elsif tok in ('tue', 'tues', 'tuesday', '화', '화요', '화요일') then
      v := array_append(v, 'Tue');
    elsif tok in ('wed', 'wednesday', '수', '수요', '수요일') then
      v := array_append(v, 'Wed');
    elsif tok in ('thu', 'thur', 'thurs', 'thursday', '목', '목요', '목요일') then
      v := array_append(v, 'Thu');
    elsif tok in ('fri', 'friday', '금', '금요', '금요일') then
      v := array_append(v, 'Fri');
    elsif tok in ('sat', 'saturday', '토', '토요', '토요일') then
      v := array_append(v, 'Sat');
    elsif tok in ('sun', 'sunday', '일', '일요', '일요일') then
      v := array_append(v, 'Sun');
    end if;
  end loop;

  -- unique sorted for stable compare
  select array_agg(x order by array_position(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], x))
  into v
  from (select distinct unnest(v) as x) s;

  if v is null or cardinality(v) = 0 then
    return 'UNSET';
  end if;

  if v = array['Mon','Wed','Fri'] then return 'MWF'; end if;
  if v = array['Tue','Thu'] then return 'TT'; end if;
  if v = array['Mon','Wed'] then return 'MW'; end if;
  if v = array['Tue','Fri'] then return 'TF'; end if;
  if v = array['Fri','Sat'] then return 'FS'; end if;
  if v = array['Mon','Tue','Wed','Thu','Fri'] then return 'MTWTF'; end if;

  return 'UNSET';
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill levels from classes.name + students.level
-- ---------------------------------------------------------------------------
insert into public.levels (name)
select distinct trim(c.name)
from public.classes c
where c.name is not null and trim(c.name) <> ''
on conflict (name) do nothing;

insert into public.levels (name)
select distinct trim(s.level)
from public.students s
where s.level is not null and trim(s.level) <> ''
on conflict (name) do nothing;

-- Existing name-only classes → level_id + placeholder schedule
update public.classes c
set
  level_id = l.id,
  days_code = coalesce(c.days_code, 'UNSET'),
  period = coalesce(nullif(trim(c.period), ''), 'UNSET')
from public.levels l
where l.name = trim(c.name)
  and c.level_id is null;

-- ---------------------------------------------------------------------------
-- Ensure a class row exists for each student schedule combo; reassign class_id
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_level_id uuid;
  v_days text;
  v_period text;
  v_class_id uuid;
  v_level_name text;
begin
  for r in
    select
      s.id as student_id,
      s.class_id,
      nullif(trim(s.level), '') as student_level,
      s.class_days,
      nullif(trim(s.period), '') as student_period,
      c.name as class_name,
      c.level_id as existing_level_id,
      c.days_code as existing_days,
      c.period as existing_period
    from public.students s
    left join public.classes c on c.id = s.class_id
  loop
    v_level_name := coalesce(r.student_level, nullif(trim(r.class_name), ''));
    if v_level_name is null and r.existing_level_id is not null then
      select name into v_level_name from public.levels where id = r.existing_level_id;
    end if;

    if v_level_name is null then
      continue; -- no class info to migrate
    end if;

    insert into public.levels (name)
    values (v_level_name)
    on conflict (name) do nothing;

    select id into v_level_id from public.levels where name = v_level_name;

    v_days := public.normalize_days_code(r.class_days);
    if v_days = 'UNSET' and r.existing_days is not null and r.existing_days <> '' then
      v_days := r.existing_days;
    end if;

    v_period := coalesce(r.student_period, nullif(r.existing_period, ''), 'UNSET');

    select id into v_class_id
    from public.classes
    where level_id = v_level_id
      and days_code = v_days
      and period = v_period
    limit 1;

    if v_class_id is null then
      insert into public.classes (name, level_id, days_code, period, is_active, sort_order)
      values (
        v_level_name || ' / ' || v_days || ' / ' || v_period,
        v_level_id,
        v_days,
        v_period,
        true,
        0
      )
      returning id into v_class_id;
    end if;

    update public.students
    set class_id = v_class_id
    where id = r.student_id
      and (class_id is distinct from v_class_id);
  end loop;
end $$;

-- Drop orphan name-only placeholder classes with no students
delete from public.classes c
where not exists (select 1 from public.students s where s.class_id = c.id)
  and (
    c.days_code = 'UNSET'
    or c.period = 'UNSET'
    or c.level_id is null
  );

-- Any remaining classes still missing structured fields
update public.classes c
set
  level_id = coalesce(
    c.level_id,
    (select l.id from public.levels l where l.name = trim(c.name) limit 1)
  ),
  days_code = coalesce(nullif(trim(c.days_code), ''), 'UNSET'),
  period = coalesce(nullif(trim(c.period), ''), 'UNSET')
where c.level_id is null or c.days_code is null or c.period is null;

-- If still no level_id, create a fallback level from name or 'UNKNOWN'
do $$
declare
  r record;
  v_level_id uuid;
  v_name text;
begin
  for r in select * from public.classes where level_id is null loop
    v_name := coalesce(nullif(trim(r.name), ''), 'UNKNOWN');
    insert into public.levels (name) values (v_name) on conflict (name) do nothing;
    select id into v_level_id from public.levels where name = v_name;
    update public.classes set level_id = v_level_id where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Enforce new shape
-- ---------------------------------------------------------------------------
alter table public.classes
  alter column level_id set not null,
  alter column days_code set not null,
  alter column period set not null;

alter table public.classes
  drop constraint if exists classes_name_key;

alter table public.classes
  drop column if exists name;

alter table public.classes
  drop constraint if exists classes_days_code_check;

alter table public.classes
  add constraint classes_days_code_check
  check (days_code in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET'));

-- Unique actual class identity
create unique index if not exists classes_level_days_period_uidx
  on public.classes (level_id, days_code, period);

-- ---------------------------------------------------------------------------
-- students: drop duplicated class fields (SoT = classes)
-- ---------------------------------------------------------------------------
alter table public.students
  drop column if exists level,
  drop column if exists class_days,
  drop column if exists period;

-- ---------------------------------------------------------------------------
-- Recreate create_student RPC (new signature — class_id only for class info)
-- ---------------------------------------------------------------------------
drop function if exists public.create_student(text, text, uuid, text, text[], text, text, text);

create or replace function public.create_student(
  p_korean_name text,
  p_english_name text default null,
  p_class_id uuid default null,
  p_enrollment_status text default 'active',
  p_parent_management_status text default 'unclassified'
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.students (
    korean_name, english_name, class_id,
    enrollment_status, parent_management_status
  ) values (
    p_korean_name, p_english_name, p_class_id,
    coalesce(p_enrollment_status, 'active'),
    coalesce(p_parent_management_status, 'unclassified')
  )
  returning * into v_student;

  insert into public.parent_status_history (
    student_id, status, changed_at, reason, changed_by
  ) values (
    v_student.id,
    v_student.parent_management_status,
    now(),
    'Initial status',
    v_uid
  );

  return v_student;
end;
$$;

grant execute on function public.create_student(text, text, uuid, text, text) to authenticated;

-- Optional helper RPCs for creating level/class safely
create or replace function public.ensure_level(p_name text, p_sort_order integer default 0)
returns public.levels
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.levels;
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'Level name required';
  end if;

  insert into public.levels (name, sort_order)
  values (v_name, coalesce(p_sort_order, 0))
  on conflict (name) do update set sort_order = public.levels.sort_order
  returning * into v;

  return v;
end;
$$;

create or replace function public.create_class(
  p_level_name text,
  p_days_code text,
  p_period text
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level public.levels;
  v_class public.classes;
  v_uid uuid := auth.uid();
  v_period text := trim(p_period);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_days_code not in ('MWF', 'TT', 'MW', 'TF', 'FS', 'MTWTF', 'UNSET') then
    raise exception 'Invalid days_code: %', p_days_code;
  end if;

  if v_period is null or v_period = '' then
    raise exception 'Period required';
  end if;

  v_level := public.ensure_level(p_level_name);

  select * into v_class
  from public.classes
  where level_id = v_level.id
    and days_code = p_days_code
    and period = v_period
  limit 1;

  if found then
    return v_class;
  end if;

  insert into public.classes (level_id, days_code, period, is_active, sort_order)
  values (v_level.id, p_days_code, v_period, true, 0)
  returning * into v_class;

  return v_class;
end;
$$;

grant execute on function public.ensure_level(text, integer) to authenticated;
grant execute on function public.create_class(text, text, text) to authenticated;
