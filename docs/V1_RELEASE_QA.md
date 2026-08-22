# Student Hub v1.0 Release QA

Release checklist for **v1.0 RC**. Existing phase QA docs are not deleted — use this for freeze sign-off.

Core regression path:

```text
Create Student → Assign Class → Quick Record → Link-first
→ Timeline → Pin Focus → Follow-up → Case
→ Deep Tracking → Calendar → Dashboard Before Class
→ Consultation Summary
```

---

## A. Interaction model

- [ ] Ordinary student usable with Record / Focus / Follow-up only
- [ ] Case / Deep Tracking are optional extensions
- [ ] User does not need to learn Voice / ABC / Intervention as separate systems first

---

## B. Navigation / Dashboard

- [ ] Top nav: Dashboard + Students / Actions / Library groups only
- [ ] Before Class not in top nav
- [ ] Dashboard tabs: Overview | Before Class
- [ ] Overview does not inline full Before Class content
- [ ] Class Detail → Before Class opens Dashboard tab with class preselected
- [ ] `/before-class` deep link still works

---

## C. Quick Record / Link-first

- [ ] Sticky / always-reachable Save + Cancel
- [ ] Tags grouped visually (Academic / Management / Student State) if categories present
- [ ] Important labeled as **중요 기록** (or equivalent)
- [ ] After save: **다시 확인 / Focus로 고정 / Case에 연결 / 끝**
- [ ] “다시 확인” creates Follow-up
- [ ] Panel does not slow the basic save path
- [ ] No “다시 보지 않기” preference (intentionally deferred)

---

## D. Student Profile (Operational / Now)

- [ ] Order: Header → Status → + Record → Focus → Open Actions → Cases → Timeline → Deep entry
- [ ] More menu holds Messages / Work Notes / 상담 / 종합 / 이력
- [ ] Deep tools do not compete with NOW actions visually
- [ ] 30s recovery: Focus, to-dos, cases, recent timeline

---

## E. Deep Tracking

- [ ] Structure: **A Evidence / B Interpretation / C Intervention**
- [ ] Interpretation disclaimer visible
- [ ] ABC remains on Observation Record Detail (심층 기록), not forced on every profile
- [ ] Existing Voice / Hypothesis / Intervention / Response data still loads

---

## F. Consultation

- [ ] **Consultation Brief** at top (Focus, Case, Recent Change, Positive, Hypothesis, Open Action, Talking Points)
- [ ] Brief is snippet/count — not a full duplicate of detail
- [ ] Detailed sections still present below
- [ ] Copy Summary includes Brief + Detail
- [ ] 20–30s skim is possible

---

## G. Learning Profile (Longitudinal)

- [ ] Banner clarifies Over Time (not today’s ops board)
- [ ] Focus / Case / Positive / Pattern / Voice / Hypothesis / Intervention emphasized
- [ ] Open Actions demoted (collapsed / secondary)
- [ ] Route `/students/:id/learning-profile` intact

---

## H. Calendar

- [ ] Filters: 전체 / 기록 / 예정
- [ ] Record = `record_date`; Due = follow-up `due_date`
- [ ] Visual distinction beyond color alone
- [ ] Same day can show both layers

---

## I. Student + Class creation

- [ ] Add Student → + 새 반 만들기 inline → auto-select, no page hop
- [ ] Class create → 학생 추가 shortcut with class preselected

---

## J. Stability / tooling

- [ ] `npm run build` passes
- [ ] `npm run test` / `npm run test:run` passes
- [ ] No new migration required for this RC
- [ ] Anon key only in frontend (no service role)

---

## K. Security note (MVP)

- [ ] Confirmed single-user / authenticated MVP posture
- [ ] Multi-user RLS redesign **out of scope** for this RC

---

## Sign-off

| Check | Owner | Date | OK |
|-------|-------|------|----|
| Interaction smoke | | | |
| Consultation Brief | | | |
| Before Class tab | | | |
| Unit tests green | | | |
| Build green | | | |

**Freeze principle:** after sign-off, do not enlarge IA or Interaction Model before 2026-09-01 ops start.
