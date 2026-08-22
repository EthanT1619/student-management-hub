# Psychology Tracking Core — Later QA Checklist

Apply `supabase/migrations/010_psychology_tracking_core.sql` first, then refresh.

## A — Student Voice
- Open Observation Record Detail → Detailed Tracking → + 학생 자기보고
- Save → visible under Student Voice
- Same student Case Detail also shows if linked via case_id when created from Case

## B — Working Hypothesis
- Create hypothesis, Confidence Low, Needs more observation
- Disclaimer visible
- Source Observation linked when created from Observation Record

## C — Evidence
- Hypothesis → Link Observation → only that student’s observations
- Other student records not available

## D — Intervention
- Guidance Record → + 개입 → Type Retrieval Practice → Save

## E — Response
- Intervention → + Response (date 1) → + Response (date 2)
- Chronological order

## F — Hypothesis Status
- Active → Supported / Unsupported / Closed (manual only)
- Optional status note

## G — Case integration
- Case Detail → Detailed Tracking accordion sections work

## H — Core intact
- Quick Record still fast (no forced psych fields)
- Follow-up / Cases / Timeline still work

## Out of scope
- Diagnosis / risk scores / AI recommendations
- Auto hypothesis from Student Voice
- Intervention effectiveness scores
