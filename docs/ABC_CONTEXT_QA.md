# ABC + Context Tags + Hypothesis–Intervention — Later QA Checklist

Apply `supabase/migrations/011_abc_context_hypothesis_interventions.sql` after 010, then refresh.

## A — ABC create
- Observation Record Detail → `+ ABC 기록`
- Antecedent / Behavior* / Consequence / Context 2개 선택 → Save
- Observation 본문(`records.content`)은 변경되지 않음

## B — ABC edit
- Edit ABC → 수정 → Save
- Record content unchanged

## C — Non-Observation
- Guidance / Stamp 등 → ABC / Context 섹션 미표시

## D — Context without ABC
- Observation → Context 편집만으로 Context Tag 저장 가능

## E — Hypothesis Evidence + ABC
- ABC가 있는 Observation을 Hypothesis Evidence로 연결
- Evidence 목록에 `ABC` badge 표시

## F — Hypothesis ↔ Intervention link
- Hypothesis → Link Intervention → 동일 학생만
- Intervention 카드에 Related Hypotheses chip 표시

## G — New Intervention from Hypothesis
- Hypothesis → `+ Intervention` → 생성 → 해당 Hypothesis 자동 연결

## H — Student isolation
- 다른 학생 Record / Intervention은 Link 목록에 없음

## I — Discoverability
- Student Profile: 데이터 0이어도 `심층 추적 / 학생 자기보고 / 작업 가설 / 개입` 문구와 `+ 작업 가설` / `심층 추적 열기` 보임
- Case Detail: Detailed Tracking 헤더에 카운트 표시, Empty state에 CTA

## J — Phase 3A intact
- Voice / Hypothesis status / Response 기존 흐름 유지

## Out of scope
- Pattern Tracker / 자동 패턴 문장
- Diagnosis / risk / effectiveness scores
- Context Tag 관리 화면
