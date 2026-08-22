# Work Notes — Later QA Checklist

Apply `supabase/migrations/008_work_notes.sql` first, then refresh the app.

## A — Faculty Meeting
- New Work Note → Type 교무회의 → Related Class DSC1 → Save
- `/work-notes` lists it; Class Detail → **Work Notes** opens filtered list

## B — Approval + Follow-up
- Type 결재 · Source 부원장님 · Add Follow-up (due today/overdue)
- Dashboard **Today's / Overdue Follow-ups** shows **Work** badge item
- Mark Done → disappears from open list; `completed_at` set

## C — Related Students
- Link 2 students on a note
- Each Profile **Work Notes N** → `/work-notes?studentId=...`

## D — Search
- Search source or content phrase → matching note

## E — Separation
- Work Note does **not** create Student Record
- Work Follow-up is separate from Student Follow-up (`work_followups` vs `followups`)

## Out of scope
- Convert to Student Record
- Work items on Before Class / Review Queue / Student Calendar
