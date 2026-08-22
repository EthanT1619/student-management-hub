# Phase 4A — UX Consolidation QA

Interaction / IA consolidation. Storage model unchanged. No new domain features.

Mental model under test:

```text
Record → Follow-up → Focus → Case → Deep Tracking
```

---

## Navigation

- [ ] Top nav shows **Dashboard** + grouped **Students / Actions / Library** (not 10 flat links).
- [ ] **Before Class** is absent from top-level nav.
- [ ] Students → Students / Classes reachable.
- [ ] Actions → Follow-ups / Review Queue / Calendar reachable.
- [ ] Library → Cases / Messages / Work Notes reachable.
- [ ] Narrow width: dropdowns do not overflow off-screen; menus remain usable.

---

## Dashboard + Before Class

- [ ] Dashboard tabs: **Overview** | **Before Class**.
- [ ] Overview does **not** dump Before Class content inline.
- [ ] Before Class tab reuses existing Before Class UI (term / class / Needs Attention / All Students).
- [ ] URL ` /dashboard?tab=before-class&classId=… ` opens Before Class with that class selected.
- [ ] Class Detail **Before Class** shortcut lands on Dashboard Before Class with class preselected.
- [ ] Classes list **Before Class** link behaves the same.
- [ ] Legacy `/before-class?classId=…` still works (deep link preserved).

---

## Student Profile hierarchy

- [ ] Header: name, class, management status, primary **+ Record**.
- [ ] Messages / Work Notes / 상담 / 종합 / 이력 are under **More** (not competing primary buttons).
- [ ] **NOW · Current Focus** visible near top.
- [ ] **Open Actions** (overdue / due follow-ups, pending stamps) visible.
- [ ] **Active Cases** section present.
- [ ] **Timeline** is the main body of history.
- [ ] Deep tools live under **학생 더 깊게 보기** (심층 추적 / 관찰 패턴 / 종합 프로필 / 상담).
- [ ] Pattern Tracker / Learning Profile are **not** loud primary cards on the main profile.

### Scenario A — ordinary student

- [ ] Can write Record, see Focus, manage Follow-up / Timeline without opening Deep Tracking.

---

## Record Detail hierarchy

- [ ] Identity (type / date / student / important / tags) at top.
- [ ] **Content** is the dominant readable block.
- [ ] Primary actions immediately after content: **Follow-up** / **Focus로 고정** / **Case에 연결**.
- [ ] Existing links (follow-ups, cases, etc.) shown compactly.
- [ ] **심층 기록** is collapsed by default; opens Context / ABC / Voice / Hypothesis / Intervention.
- [ ] Guidance records: deep panel copy frames Intervention as extension of guidance.
- [ ] Buttons do not wrap awkwardly; narrow width stacks primary actions cleanly.
- [ ] Edit / Important are secondary; Delete remains destructive and secondary.

---

## Link-first flow (Quick Record)

- [ ] Quick Record save remains fast (form itself not heavier).
- [ ] After save (when not already linking into a Case): panel asks “이 기록으로 더 할 일이 있나요?”
- [ ] **다시 확인하기** → Follow-up
- [ ] **현재 Focus로 고정** → Current Focus
- [ ] **Case에 연결** → existing / new Case
- [ ] **끝** closes without forcing links
- [ ] Saving with `linkCaseId` skips the after panel (no double prompt)

### Scenario B

- [ ] Follow-up / Focus / Case connectable without leaving the page.

---

## Focus pin

- [ ] Record Detail **Focus로 고정** creates/opens Current Focus from that record.
- [ ] Existing Focus data still loads; no mass clear/migration.
- [ ] Profile still allows secondary “Add Current Focus” if present.

---

## Case linking

### Scenario C

- [ ] Record Detail → **Case에 연결** lists existing Cases.
- [ ] **+ 새 Case 만들기** creates Case and auto-links the current Record.
- [ ] `case_records` N:M preserved; no schema merge.

---

## Deep Tracking entry

### Scenario D / J

- [ ] Main profile does not force Voice / Hypothesis / Intervention / Pattern equally.
- [ ] **학생 더 깊게 보기** → 심층 추적 opens Detailed Tracking; existing Voice / Hypothesis / Intervention / Response data visible.
- [ ] **관찰 패턴** opens Pattern Tracker; aggregates unchanged.
- [ ] Learning Profile route still works from deep / More.
- [ ] Management status (지속/집중/장기위험) is **not** auto-tied to Deep Tracking visibility.

---

## Student + Class creation

### Scenario F

- [ ] Add Student → Class selector → **+ 새 반 만들기** opens inline form (Term / Level / Days / Period).
- [ ] After Class save: modal closes, selector refreshes, new Class selected, other student fields kept.
- [ ] No page hop to Classes to finish student create.

### Class → Student shortcut

- [ ] After creating a Class on Classes page, **학생 추가** banner appears.
- [ ] Opens `/students?add=1&classId=…` with form open and Class preselected.

---

## Calendar Records vs Due

### Scenario I

- [ ] Filters: **전체 / 기록 / 예정**.
- [ ] Record markers use student accent / name (event date = `record_date`, not `created_at`).
- [ ] Due markers use outline / ◯ Due style (not color-only); Follow-up `due_date` (+ work follow-ups if present).
- [ ] Same day can show both Record and Due.
- [ ] Day panel lists records and dues distinctly.

---

## Narrow width

- [ ] Nav groups usable.
- [ ] Profile header + More usable.
- [ ] Record Detail primary action row stacks without horizontal overflow.
- [ ] Calendar filters remain tappable (full mobile redesign out of scope).

---

## Regression checklist

- [ ] Auth / login
- [ ] Students / Classes / Terms / Class History
- [ ] Quick Record + Timeline + Tags + Important
- [ ] Follow-ups / Stamp / Review Queue
- [ ] Messages / Work Notes (still separate archives)
- [ ] Cases list page
- [ ] ABC / Context / Hypothesis Evidence / H↔I
- [ ] Consultation Summary still reachable
- [ ] No unexpected data loss for any existing student records

---

## Schema / migration

Phase 4A expects **no new migration**. Confirm:

- [ ] No `013_*.sql` required for this Phase
- [ ] Migrations through `012` remain the applied set

---

## Success criteria (manual)

1. After an incident, the user does not first ask “which menu do I write this in?”
2. Ordinary students are manageable with Record / Focus / Follow-up only.
3. Case and Deep Tracking appear when needed, not by default.
4. Feature count stays; simultaneous cognitive load drops.
