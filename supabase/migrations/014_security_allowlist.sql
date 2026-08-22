-- 014_security_allowlist.sql
-- Foundation only: allowlist table + access-check functions.
-- Does NOT change application table RLS policies (avoids lockout before owner email is registered).
--
-- After this migration, register owner email before running 015:
--   insert into public.allowed_student_hub_users (email, note)
--   values ('YOUR_GOOGLE_EMAIL@example.com', 'owner');

-- ---------------------------------------------------------------------------
-- Allowlist table
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_student_hub_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  is_active boolean not null default true,
  note text null,
  created_at timestamptz not null default now()
);

create unique index if not exists allowed_student_hub_users_email_lower_uidx
  on public.allowed_student_hub_users (lower(email));

alter table public.allowed_student_hub_users enable row level security;

-- No policies for authenticated/anon: table is not readable/writable from the client.
-- SECURITY DEFINER functions (owner) can still read for access checks.

comment on table public.allowed_student_hub_users is
  'Student Hub v1.0 email allowlist. Manage via SQL Editor / Dashboard only. No client policies.';

-- ---------------------------------------------------------------------------
-- Access check: returns boolean only (no email list exposure)
-- ---------------------------------------------------------------------------
create or replace function public.is_student_hub_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_student_hub_users a
    where a.is_active = true
      and lower(a.email) = lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''))
  );
$$;

comment on function public.is_student_hub_user() is
  'True when JWT email is an active Student Hub allowlist entry.';

create or replace function public.assert_student_hub_user()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_student_hub_user() then
    raise exception 'Student Hub access denied';
  end if;
end;
$$;

revoke all on function public.is_student_hub_user() from public;
revoke all on function public.is_student_hub_user() from anon;
revoke all on function public.assert_student_hub_user() from public;
revoke all on function public.assert_student_hub_user() from anon;

grant execute on function public.is_student_hub_user() to authenticated;
grant execute on function public.assert_student_hub_user() to authenticated;
