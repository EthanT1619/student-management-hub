-- 017_ownership_helpers.sql
-- Batch 2: admin / ownership helper functions ONLY.
-- Does NOT change RLS policies, class unique indexes, or owner_id nullability.
-- Depends on: 014 (allowlist), 016 (role + owner_id columns).

-- ---------------------------------------------------------------------------
-- is_student_hub_admin()
-- ---------------------------------------------------------------------------
create or replace function public.is_student_hub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.allowed_student_hub_users a
      where a.is_active = true
        and a.role = 'admin'
        and lower(a.email) = lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''))
    );
$$;

comment on function public.is_student_hub_admin() is
  'True when JWT email is an active allowlist admin. UX + RPC guard; RLS still separate.';

-- ---------------------------------------------------------------------------
-- assert_student_hub_admin()
-- ---------------------------------------------------------------------------
create or replace function public.assert_student_hub_admin()
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
  if not public.is_student_hub_admin() then
    raise exception 'Student Hub admin access required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- owns_student / owns_class (DEFINER reads bypass RLS — recursion-safe)
-- ---------------------------------------------------------------------------
create or replace function public.owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_student_id is null or auth.uid() is null then false
    when public.is_student_hub_admin() then true
    when not public.is_student_hub_user() then false
    else exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.owner_id = auth.uid()
    )
  end;
$$;

create or replace function public.owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_class_id is null or auth.uid() is null then false
    when public.is_student_hub_admin() then true
    when not public.is_student_hub_user() then false
    else exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.owner_id = auth.uid()
    )
  end;
$$;

create or replace function public.assert_owns_student(p_student_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_student_hub_user();
  if not public.owns_student(p_student_id) then
    raise exception 'Student access denied: %', p_student_id;
  end if;
end;
$$;

create or replace function public.assert_owns_class(p_class_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_student_hub_user();
  if not public.owns_class(p_class_id) then
    raise exception 'Class access denied: %', p_class_id;
  end if;
end;
$$;

revoke all on function public.is_student_hub_admin() from public;
revoke all on function public.is_student_hub_admin() from anon;
revoke all on function public.assert_student_hub_admin() from public;
revoke all on function public.assert_student_hub_admin() from anon;
revoke all on function public.owns_student(uuid) from public;
revoke all on function public.owns_student(uuid) from anon;
revoke all on function public.owns_class(uuid) from public;
revoke all on function public.owns_class(uuid) from anon;
revoke all on function public.assert_owns_student(uuid) from public;
revoke all on function public.assert_owns_student(uuid) from anon;
revoke all on function public.assert_owns_class(uuid) from public;
revoke all on function public.assert_owns_class(uuid) from anon;

grant execute on function public.is_student_hub_admin() to authenticated;
grant execute on function public.assert_student_hub_admin() to authenticated;
grant execute on function public.owns_student(uuid) to authenticated;
grant execute on function public.owns_class(uuid) to authenticated;
grant execute on function public.assert_owns_student(uuid) to authenticated;
grant execute on function public.assert_owns_class(uuid) to authenticated;
