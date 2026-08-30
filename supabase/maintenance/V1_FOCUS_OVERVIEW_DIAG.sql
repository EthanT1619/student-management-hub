-- Read-only: Current Focus Overview vs Attention diagnostic
-- Run in Supabase SQL Editor. Does not modify data.

-- A) Open focus count (Dashboard Overview source)
select count(*) as open_focus_items
from public.current_focus_items
where status = 'open';

-- B) Attention students (intensive_care / retention_risk)
select count(*) as attention_students
from public.students
where parent_management_status in ('intensive_care', 'retention_risk');

-- C) Attention students missing an open Focus
select s.korean_name, s.parent_management_status
from public.students s
where s.parent_management_status in ('intensive_care', 'retention_risk')
  and not exists (
    select 1
    from public.current_focus_items f
    where f.student_id = s.id and f.status = 'open'
  )
order by s.korean_name;

-- D) Named students — open/done focus rows
select
  s.korean_name,
  f.status,
  f.title,
  f.sort_order,
  f.created_at
from public.students s
left join public.current_focus_items f on f.student_id = s.id
where s.korean_name in ('김도연', '김서진')
order by s.korean_name, f.status, f.sort_order, f.created_at;
