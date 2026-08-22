# Learning Profile + Consultation Summary — Later QA Checklist

Apply `supabase/migrations/012_consultation_notes.sql` after 011, then refresh.

## A — Empty Student
- 데이터 거의 없는 학생 → 종합 프로필 / 상담 요약 진입 가능
- Empty State 문구, 화면 깨짐 없음

## B — Entry points
- Student Profile 상단: `종합 프로필` / `상담 요약` 버튼 (데이터 0이어도 표시)

## C — Learning Profile sections
- Header (이름 / 반 / 관리상태 / Focus·Case·FU counts)
- Current Focus (open only)
- Open Actions (overdue / today / stamp)
- Active Cases
- Positive Evidence
- Recent Snapshot (30일)
- Pattern compact + `전체 Pattern 보기`
- Voice / Hypothesis / Intervention (collapsible, 구분)
- Parent Contact + Messages shortcut
- Consultation history

## D — Pattern reuse
- Profile Top Context/Tag가 Pattern Tracker와 동일 utility 기준

## E — Fact / Interpretation
- Student Voice와 Working Hypothesis가 별도 섹션
- Hypothesis disclaimer 표시
- 효과율 / 진단 문구 없음

## F — Consultation Summary
- 기간 30일 / 학기 / 90일
- Observed / Student Said / Teacher Interpretation 분리
- Talking Points + Outcome → Save
- History에 표시
- Parent Contact 자동 생성 없음

## G — Copy Summary
- Copy Summary 클릭 시에만 clipboard
- plain text에 `[Teacher Working Hypothesis]` 명시
- toast: 상담 요약을 복사했습니다.

## H — Student isolation / RLS
- 다른 학생 consultation_notes 미혼입
- authenticated only

## Out of scope
- Auto talking points / diagnosis / risk
- PDF export
- Summary JSON snapshot 저장
