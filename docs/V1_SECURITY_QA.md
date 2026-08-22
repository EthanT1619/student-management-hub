# Student Hub v1.0 — Security QA

Google OAuth + email allowlist + RLS lockdown checklist.

Security boundary = **Supabase RLS / DB functions**. Frontend Access Denied is UX only.

---

## Deployment order (lockout-safe)

1. [ ] Run `014_security_allowlist.sql`
2. [ ] Register owner Gmail in allowlist (**before 015**)
3. [ ] Configure Google OAuth (Supabase + Google Cloud)
4. [ ] Run `015_security_rls_lockdown.sql`
5. [ ] Sign out any old sessions
6. [ ] Google login as owner → Hub OK
7. [ ] Optional: non-allowlisted Google account → Access Denied + RLS deny

Owner register SQL (placeholder — do not commit real email):

```sql
insert into public.allowed_student_hub_users (email, note)
values ('YOUR_GOOGLE_EMAIL@example.com', 'owner');
```

---

## Auth UX

- [ ] Login shows **Google로 로그인** (no public Sign Up)
- [ ] Authorized Google account enters Dashboard
- [ ] Unauthorized Google account sees Access Denied + Logout
- [ ] Loading does not flash Hub chrome before allowlist check finishes
- [ ] Logout clears session; protected routes redirect to Login
- [ ] Direct URL `/students/...` while unauthorized → Access Denied / Login

---

## RLS

| Actor | Expected |
|-------|----------|
| anon | SELECT/INSERT/UPDATE/DELETE fail on app tables |
| authenticated + allowlist | CRUD OK |
| authenticated + not allowlisted | CRUD fail even if UI bypassed |
| allowlist `is_active = false` | denied |

Spot-check at least: `students`, `records`, `cases`, `consultation_notes`.

---

## RPC

- [ ] `create_student` / `change_parent_management_status` / `create_class` fail for non-allowlisted authenticated user
- [ ] Same RPCs succeed for allowlisted user

---

## Secrets / client

- [ ] Frontend env only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] No service_role / Google Client Secret in repo or `.env` used by Vite
- [ ] `.env` gitignored
- [ ] No access/refresh tokens in `console.log`
- [ ] No student PII dumped to console

---

## OAuth redirects

- [ ] Local: Site URL / redirect includes `http://localhost:5173` (or your Vite port)
- [ ] Production: Site URL + Redirect URLs match deployed origin
- [ ] Google Cloud Authorized redirect URIs include Supabase callback

---

## Sign-off

| Check | Date | OK |
|-------|------|----|
| Owner allowlisted before 015 | | |
| Google login owner | | |
| Unauthorized account | | |
| RLS spot-check | | |
| Build/test green | | |
