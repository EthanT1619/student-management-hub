# Student Management Hub

교사 전용 종단 학생관리 허브 — **v1.0 Release Candidate**.

목표: 일상 수업·상담에서 **Record → Follow-up → Focus → Case → (필요 시) Deep Tracking** 으로 학생을 관리한다.

설계 참고: `docs/MVP_SCHEMA_AND_WIREFRAMES.md`  
릴리스: `docs/V1_RELEASE_NOTES.md` · QA: `docs/V1_RELEASE_QA.md` · Security: `docs/V1_SECURITY_QA.md`

---

## Stack

- React 19 + TypeScript + Vite
- Supabase (Auth + Postgres) — **Google OAuth + email allowlist + RLS**
- Vitest (unit tests for pure business logic)

---

## Setup

1. Create a Supabase project.
2. In SQL Editor, run migrations **in order** (skip steps already applied):

| # | File |
|---|------|
| 1–12 | `001` … `012` (see prior docs) |
| 13 | `013_management_status_new_student.sql` |
| 14 | `014_security_allowlist.sql` ← allowlist table + `is_student_hub_user()` |
| — | **Insert owner Google email** (see Security below) |
| 15 | `015_security_rls_lockdown.sql` ← drop broad policies / lock RLS |

3. Copy `.env.example` → `.env` and set **only**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Never put `service_role` / Google Client Secret in frontend env.

```bash
npm install
npm run dev
```

PowerShell: `npm.cmd install` / `npm.cmd run dev`.

### Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Typecheck + production build |
| `npm run test` / `npm run test:run` | Vitest |

---

## Security / Auth (v1.0)

Student Hub v1.0 access model:

1. **Google OAuth** (Supabase Auth)
2. **Email allowlist** (`allowed_student_hub_users`)
3. **RLS** requiring `is_student_hub_user()`
4. Frontend Access Denied UX (not a security boundary)

Google login success alone is **not** enough to read/write Hub data.

Multi-teacher ownership / roles are **not** implemented. Trusted small allowlist only.

### Lockout-safe SQL order

```text
1) 014_security_allowlist.sql
2) INSERT owner email into allowed_student_hub_users
3) Configure Google provider (Dashboard + Google Cloud)
4) 015_security_rls_lockdown.sql
5) Logout → Google login as owner
```

Register email (placeholder — do not commit real address):

```sql
insert into public.allowed_student_hub_users (email, note)
values ('YOUR_GOOGLE_EMAIL@example.com', 'owner');
```

Deactivate without delete:

```sql
update public.allowed_student_hub_users
set is_active = false
where lower(email) = lower('someone@example.com');
```

### Supabase Dashboard (manual)

1. Authentication → Providers → **Google** → Enable  
2. Paste Google OAuth **Client ID** / **Client Secret** (secret stays in Dashboard only)  
3. Authentication → URL Configuration  
   - Site URL: `http://localhost:5173` (dev) or production origin  
   - Redirect URLs: same origins (app uses `/login` as OAuth `redirectTo`)  
4. Run migrations 014 → allowlist insert → 015  

### Google Cloud Console (manual)

1. APIs & Services → Credentials → OAuth 2.0 Client (Web)  
2. Authorized JavaScript origins: app origins (localhost + production)  
3. Authorized redirect URIs: Supabase callback  
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`  
4. Copy Client ID/Secret into Supabase Google provider  

### Known limitations

- Single trusted-allowlist model (not per-teacher row ownership)
- Allowlist managed in SQL/Dashboard only (no admin UI)
- Email/password Sign Up UI removed; Auth users may still exist in Supabase from earlier MVP

Full checklist: `docs/V1_SECURITY_QA.md`

---

## Major modules

| Area | Location |
|------|----------|
| API (domain split) | `src/lib/api/` |
| Auth / Hub gate | `src/context/AuthContext.tsx`, `src/lib/hubAccess.ts` |
| Before Class / Review / Pattern / Summary | `src/lib/*.ts` |

---

## Out of scope for v1.0

AI 분석, 성적 시스템, PDF export, custom taxonomy builder, multi-user role redesign, 모바일 전면 재설계.
