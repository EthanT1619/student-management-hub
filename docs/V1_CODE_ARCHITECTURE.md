# Student Hub v1.0 — Code Architecture

Living map of the codebase after Phase 4A UX consolidation and Post-RC selective refactoring.

**Principle:** Interaction Model and DB stay stable; structure exists to shrink change blast radius.

---

## Source directories

```text
src/
  App.tsx                 # routes + Quick Record host
  components/
    cases/                # CaseDetailModal, CaseFormModal
    studentProfile/       # Focus / Open Actions sections
    Layout.tsx            # grouped navigation
    QuickRecordModal.tsx
    RecordDetailModal.tsx
    DetailedTrackingPanel.tsx
    PatternTrackerModal.tsx
    ConsultationSummaryModal.tsx
    LinkCasePanel.tsx
    AbcContextSection.tsx
    …
  pages/                  # route-level screens
  lib/
    api/                  # domain API modules + barrel index
    beforeClass.ts
    reviewQueue.ts
    patternTracker.ts     # pure aggregations
    patternSnapshot.ts    # fetch + snapshot helper
    studentSummary.ts     # Learning / Consultation models
    constants.ts
    types.ts
  context/AuthContext.tsx
```

---

## Domain APIs (`src/lib/api/`)

| Module | Responsibility |
|--------|----------------|
| `terms.ts` | Terms |
| `classes.ts` | Classes, levels, class stats |
| `students.ts` | Students, tags, class/parent history |
| `focus.ts` | Current Focus |
| `records.ts` | Quick Record, timeline, calendar marks, stamps |
| `followups.ts` | Follow-ups |
| `beforeClassApi.ts` | Before Class bundle |
| `review.ts` | Review Queue |
| `messages.ts` | Message archive |
| `workNotes.ts` | Work notes |
| `cases.ts` | Cases + case↔record |
| `psychology.ts` | Voice, Hypothesis, Intervention, ABC, Context |
| `pattern.ts` | Pattern source bundle |
| `consultations.ts` | Consultation notes + student overview bundle |
| `_shared.ts` | Select strings + normalize helpers |
| `index.ts` | Public barrel (`import … from '../lib/api'`) |

Call sites should keep using `../lib/api` unless a circular import forces a direct path.

---

## Major pages

| Page | Role |
|------|------|
| Dashboard | Overview + Before Class tab |
| Students / Classes / Class Detail | Roster & class ops |
| Student Profile | **Operational / Now** |
| Learning Profile | **Longitudinal / Over Time** |
| Follow-ups / Review / Calendar | Action surfaces |
| Cases / Messages / Work Notes | Library archives |
| Before Class route | Legacy deep link (also embedded in Dashboard) |

---

## Shared components (high leverage)

- **QuickRecordModal** — capture + link-first panel
- **RecordDetailModal** — Record hub (actions → links → deep)
- **DetailedTrackingPanel** — Evidence / Interpretation / Intervention
- **PatternTrackerModal** — analytical view (loads bundle on open)
- **ConsultationSummaryModal** — Brief + detail (`studentSummary`)
- **cases/** — Case detail/form (used by Cases page + Profile)

---

## Business logic utilities

| File | Pure? | Used for |
|------|-------|----------|
| `beforeClass.ts` | Yes | Attention rules / ordering |
| `reviewQueue.ts` | Yes | Review item rules |
| `patternTracker.ts` | Yes | Counts, cross-tab, reports, snapshots |
| `patternSnapshot.ts` | Thin I/O | `loadPatternSnapshot` |
| `studentSummary.ts` | Yes | Learning model, Consultation model/Brief |

UI components should call these rather than re-implementing filters/counts.

---

## Data flow (Student Profile)

```text
load()
  → student, focus, records, cases, tags, history,
    message/work counts, detailedTrackingSummary
  → Obs count derived from already-loaded records
  → Pattern Tracker fetches its own bundle only when opened
  → Consultation fetches overview bundle when opened
    (Learning Profile may pass initialBundle)
```

Avoid re-fetching `fetchPatternSourceBundle` on every Profile visit for a decorative Obs chip.

---

## Tests

```text
npm run test       # vitest watch
npm run test:run   # CI single run

src/lib/__tests__/
  beforeClass.test.ts
  reviewQueue.test.ts
  patternTracker.test.ts
  studentSummary.test.ts
```

Characterization tests protect pure builders during refactors. No UI E2E required for v1.0 RC.

---

## Security / Auth (v1.0)

- Google OAuth + `allowed_student_hub_users` + `is_student_hub_user()` RLS
- Migrations: `014_security_allowlist.sql` then owner email insert then `015_security_rls_lockdown.sql`
- Frontend gate: `AuthContext` + `AccessDeniedPage` (UX only; RLS is the boundary)
- See `docs/V1_SECURITY_QA.md`

## Selective refactor notes (Post-RC)

**Did**
- Extract Case modals from CasesPage
- Move `loadPatternSnapshot` to `lib/patternSnapshot.ts`
- Remove Profile eager pattern-bundle fetch; derive Obs from records
- Remove unused `PatternProfileCard`

**Did not (intentionally)**
- Split DetailedTrackingPanel / Messages / WorkNotes / Pattern report UI
- Split RecordDetailModal further (deep already delegated)
- Rewrite `api/` domain layout

---

## Security / hygiene (ops follow-up)

- Frontend uses anon key only (`VITE_SUPABASE_*`)
- `.gitignore` includes `.env`, `node_modules`, `dist`
- Multi-user RLS redesign is out of scope here
