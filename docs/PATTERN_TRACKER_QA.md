# Pattern Tracker — Later QA Checklist

No new migration required for Phase 3C (client-side aggregation over existing tables).

Ensure 010 + 011 are applied so Context / ABC / Intervention data exists.

## A — Date Range
- Student Profile → 패턴 보기
- 현재 학기 / 30일 / 90일 / 전체 / Custom
- 필터 변경 시 count가 동일 source 기준으로 바뀜

## B — Context
- Observation에 Context 부여 후 Distribution 빈도 확인
- Observation 1개에 Context 2개 → 각각 +1 (합계 ≥ Observation 수 가능)

## C — Tags
- Observation Tag 집계
- Toggle Observation / Guidance / Positive Note / All

## D — Cross-tab
- Context × Tag 교차 count
- Context 기준 / Tag 기준 필터

## E — ABC
- ABC count + 목록 snippet
- 항목 클릭 → Record Detail
- Behavior 자동 분류 문구/카테고리 없음

## F — Intervention
- Type별 count
- 클릭 시 목록·Related Hypothesis·Response 표시

## G — Response
- descriptive count만 (Positive N, Mixed N…)
- 효과율 / % 성공 표시 없음

## H — Hypothesis / Cases
- Active Hypothesis 참고 표시 (자동 Supported 문구 없음)
- Active Case → Case Detail

## I — Positive Notes
- Tag 집계 + 최근 목록

## J — Time Trend
- ≤90일 주별 / >90일 월별

## K — Student isolation
- 다른 학생 Pattern에 섞이지 않음

## L — Empty / Discoverability
- 데이터 0이어도 Profile에 관찰 패턴 섹션 표시
- Empty state 안내 문구 확인

## Out of scope
- Class 비교 / ranking / risk meter
- Auto hypothesis / recommendation
- Pattern cache table
