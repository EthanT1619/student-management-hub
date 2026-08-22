# Cases — Later QA Checklist

Apply `supabase/migrations/009_cases.sql` first, then refresh the app.

## A — Create Case
- Student Profile → **+ Case** → title/type/priority → Save
- Active Case appears under Cases section

## B — Link Existing Record
- Open Case → **Link Existing Record**
- Only that student’s records listed
- Link → appears on Case Timeline

## C — Other student blocked
- Link modal must not offer another student’s records

## D — New Record from Case
- Case Detail → **+ New Record**
- Save via Quick Record
- Record auto-linked to Case; Timeline updates

## E — Follow-up aggregate
- Linked record has open Follow-up
- Case Detail shows it under Open Follow-ups

## F — Resolve
- Resolve (+ optional Outcome)
- status `resolved`, `closed_at` set, Outcome kept

## G — Close / Reopen
- Close similarly
- Reopen → status `open`, `closed_at` cleared, Timeline/Outcome remain

## H — Cases page filters
- `/cases` Active by default
- Filter Status / Priority / Type / Class / Student / Search

## Out of scope
- Psychology / ABC / risk scores
- Auto Management Status change
- Auto Current Focus
- Message / Work Note auto-link
