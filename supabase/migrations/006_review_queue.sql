-- 006_review_queue.sql
-- Review Queue: persist teacher Snooze / Dismiss only (rules are computed, not stored).

create table if not exists public.review_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  rule_type text not null
    check (rule_type in (
      'stale_focus',
      'observation_without_followup',
      'parent_contact_without_followup',
      'student_without_recent_record'
    )),
  source_type text not null
    check (source_type in ('focus', 'record', 'student')),
  source_id uuid,
  trigger_key text not null,
  action text not null
    check (action in ('dismissed', 'snoozed')),
  snoozed_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_actions_trigger_unique unique (user_id, trigger_key)
);

create index if not exists review_actions_user_idx
  on public.review_actions (user_id);

create index if not exists review_actions_student_idx
  on public.review_actions (student_id);

alter table public.review_actions enable row level security;

create policy "users_own_review_actions" on public.review_actions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
