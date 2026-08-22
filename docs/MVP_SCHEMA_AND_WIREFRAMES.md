# Student Management Hub — MVP Schema & Wireframes (확정 초안)

> **문서 상태:** 구현 기준 확정안 (승인 + 후속 3항 반영)  
> **범위:** DB Schema, 관계도, Seed, Wireframe, User Flow, 구현 순서  
> **반영 결정 (2026-08-11):**
>
> - Message Archive / Meeting·Approval Notes → **Phase 2** (스키마·구조로 추가를 막지 않음)
> - Follow-up = Record **1 : N**
> - `parent_record_id` 등 미확정 예약 컬럼 **미포함**
> - Parent Management Status 변경은 **원자적** (현재값 + History 일치)
> - Current Focus = 복수 item (Tag와 개념 분리; `tag_id`는 선택적 연결만)
> - CQ / 단어시험 점수 / 보강 일정 / Dream Tree 정기 체크 / 교재검수 → **계속 제외**
> - `students.is_active` **제거** → `enrollment_status`로 일원화 (`active` / `inactive` / `withdrawn`)
> - Stamp `stamp_reason` **제거** → 사유는 `records.content` 사용
> - 학생 반 이동 이력(Class History) → **Phase 2 TODO** (MVP 미구현)

---

# 1. Supabase / PostgreSQL MVP Schema 최종 초안

## 1.1 설계 원칙

| 원칙 | 내용 |
|------|------|
| Source of Truth | Supabase (PostgreSQL) |
| Type 확장 | `record_type` 텍스트/enum — Type별 boolean 컬럼 금지 |
| Tag 확장 | `tags` + `record_tags` M:N — Tag별 boolean 컬럼 금지 |
| Stamp | 별도 테이블이 아니라 `records`의 `record_type = 'stamp'` |
| Follow-up | 독립 Type 아님; `followups.record_id`로 Record에 부착 (1:N) |
| History | Parent Status는 덮어쓰기만 하지 않음; 현재값 + history 원자 갱신 |
| Phase 2 여지 | `messages`, `meeting_notes` 등을 MVP에 만들지 않되, 학생/기록 중심 FK를 막지 않음 |
| 개인정보 | 주소·주민등록 등 Hub 목적 외 필드 미저장 |

---

## 1.2 Enum / 허용 값 (CHECK 또는 Postgres ENUM)

구현 시 Postgres `ENUM` 또는 `TEXT + CHECK` 중 선택 가능. 아래는 허용 값 정의.

| 이름 | 값 |
|------|-----|
| `enrollment_status` | `active`, `inactive`, `withdrawn` |
| `parent_management_status` | `unclassified`, `stable`, `intensive_care`, `retention_risk`, `temporary_leave`, `withdrawn` |
| `record_type` | `observation`, `guidance`, `parent_contact`, `positive_note`, `stamp`, `general_note` |
| `contact_method` | `phone`, `message`, `in_person`, `other` |
| `stamp_status` | `pending`, `given` |
| `followup_status` | `open`, `done` |
| `focus_item_status` | `open`, `done` |

표시명(한국어)은 앱 레이어 상수로 매핑. DB에는 영어 코드만 저장.

| DB 코드 | UI 표시 (예) |
|---------|----------------|
| `unclassified` | 미분류 |
| `stable` | 지속 |
| `intensive_care` | 집중 |
| `retention_risk` | 장기위험생 |
| `temporary_leave` | 구간장기 |
| `withdrawn` | 장기 |

---

## 1.3 Tables

### `profiles`

Auth 사용자 확장. 개인용 MVP에서도 향후 role 확장을 막지 않기 위해 둠.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `display_name` | `text` | YES | — | |
| `role` | `text` | NO | `'instructor'` | MVP는 사실상 단일 사용자; 값만 예약 |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**FK:** `id` → `auth.users(id)`

---

### `classes`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | 예: `DSC1` |
| `is_active` | `boolean` | NO | `true` | |
| `sort_order` | `integer` | NO | `0` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**UNIQUE:** `name` (학원 내 반 이름 중복 방지; 정책에 따라 완화 가능)

---

### `students`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `korean_name` | `text` | NO | — | |
| `english_name` | `text` | YES | — | |
| `class_id` | `uuid` | YES | — | FK → `classes(id)` ON DELETE SET NULL |
| `level` | `text` | YES | — | |
| `class_days` | `text[]` | YES | — | 예: `{Mon,Wed}` 또는 별도 정규화는 Phase 2 |
| `period` | `text` | YES | — | 교시/시간대 |
| `enrollment_status` | `text` | NO | `'active'` | CHECK. 목록 필터·표시도 이 필드로 일원화 (`is_active` 없음) |
| `parent_management_status` | `text` | NO | `'unclassified'` | 현재값 캐시; History와 원자 동기화 |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**FK:** `class_id` → `classes(id)`  
**CHECK:** `enrollment_status`, `parent_management_status` 허용 값  
**비고:** `current_focus` 단일 문자열 컬럼 **없음**. Focus는 `current_focus_items`.  
**비고:** `is_active`는 `enrollment_status`와 역할이 중복되어 **제거**. 재원/비활성/퇴원은 `enrollment_status`만 사용.

---

### `current_focus_items`

Current Focus ≠ Tag. Tag는 선택적 참조만.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `student_id` | `uuid` | NO | — | FK → `students(id)` ON DELETE CASCADE |
| `title` | `text` | NO | — | label 역할 (예: Vocabulary, Homework) |
| `note` | `text` | YES | — | 관찰/관리 설명 |
| `tag_id` | `uuid` | YES | — | 선택 FK → `tags(id)` ON DELETE SET NULL; Tag와 Focus 동일시하지 않음 |
| `status` | `text` | NO | `'open'` | `open` \| `done` |
| `sort_order` | `integer` | NO | `0` | 프로필 상단 표시 순서 |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `completed_at` | `timestamptz` | YES | — | status=done 시 |

**PK:** `id`  
**FK:** `student_id`, `tag_id`  
**CHECK:** `status IN ('open','done')`  
**권장 앱 규칙:** open item 0~3 (DB hard limit는 선택; CHECK로 강제하지 않아도 됨)

---

### `tags`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | 예: `Vocabulary` |
| `category` | `text` | NO | — | `academic` \| `learning_management` \| `classroom_state` |
| `sort_order` | `integer` | NO | `0` | |
| `is_active` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**UNIQUE:** `name`  
**CHECK:** `category` 허용 값 (필요 시)

---

### `records`

Hub의 핵심 단위.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `student_id` | `uuid` | NO | — | FK → `students(id)` ON DELETE CASCADE |
| `record_date` | `date` | NO | `CURRENT_DATE` | Timeline/Calendar 기준일 |
| `record_type` | `text` | NO | — | 6종 CHECK |
| `content` | `text` | NO | — | 본문. Stamp 사유도 이 필드 사용 (`stamp_reason` 없음) |
| `is_important` | `boolean` | NO | `false` | Normal / Important |
| `contact_method` | `text` | YES | — | Parent Contact일 때만 사용 |
| `stamp_amount` | `integer` | YES | — | Stamp일 때 |
| `stamp_status` | `text` | YES | — | `pending` \| `given` |
| `stamp_given_at` | `date` | YES | — | 지급일 |
| `created_by` | `uuid` | YES | — | FK → `profiles(id)` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**FK:** `student_id`, `created_by`  
**CHECK:**
- `record_type` ∈ 6종
- `contact_method` NULL 이거나 허용 값
- `stamp_status` NULL 이거나 `pending`/`given`
- **Stamp 정합 (권장):**  
  `record_type = 'stamp'` → `stamp_amount IS NOT NULL AND stamp_amount > 0 AND stamp_status IS NOT NULL` 및 `content`에 사유  
  `record_type <> 'stamp'` → `stamp_amount` / `stamp_status` / `stamp_given_at` NULL  
- **Parent Contact (권장 soft):** `contact_method`는 type이 parent_contact일 때만 채움 (앱 검증 우선, DB CHECK 선택)

**미포함 (의도적):** `parent_record_id`, `stamp_reason`, Outcome 전용 컬럼, ABC/Student Voice 등 Phase 3 필드

---

### `record_tags`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `record_id` | `uuid` | NO | — | FK → `records(id)` ON DELETE CASCADE |
| `tag_id` | `uuid` | NO | — | FK → `tags(id)` ON DELETE CASCADE |

**PK:** `(record_id, tag_id)`

---

### `followups`

Record 1 : Follow-up N.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `record_id` | `uuid` | NO | — | FK → `records(id)` ON DELETE CASCADE |
| `due_date` | `date` | YES | — | |
| `note` | `text` | NO | — | 확인할 내용 |
| `status` | `text` | NO | `'open'` | `open` \| `done` |
| `completed_at` | `timestamptz` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**FK:** `record_id` → `records(id)`  
**CHECK:** `status IN ('open','done')`  
**파생 상태:** `overdue` = `status = 'open' AND due_date < CURRENT_DATE` (저장하지 않음)

---

### `parent_status_history`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `student_id` | `uuid` | NO | — | FK → `students(id)` ON DELETE CASCADE |
| `status` | `text` | NO | — | parent_management_status 허용 값 |
| `changed_at` | `timestamptz` | NO | `now()` | |
| `reason` | `text` | YES | — | 사유/메모 |
| `changed_by` | `uuid` | YES | — | FK → `profiles(id)` |
| `created_at` | `timestamptz` | NO | `now()` | |

**PK:** `id`  
**FK:** `student_id`, `changed_by`  
**CHECK:** `status` 허용 값  
**비고:** Phase 2에서 “근거 Record 연결”은 별도 연결 테이블로 추가 가능 (MVP 미포함)

---

## 1.4 Parent Status 원자적 변경

**목표:** `students.parent_management_status`와 `parent_status_history` 최신 행이 불일치하지 않음.

### 권장 방식: DB Function + 단일 Transaction

`change_parent_management_status(p_student_id, p_new_status, p_reason, p_changed_at?, p_changed_by?)`

단일 트랜잭션 내에서:

1. `students` row `SELECT … FOR UPDATE`
2. 현재 status와 `p_new_status`가 같으면 no-op 또는 reason만 history에 남길지 정책 결정 (권장: **동일 status면 history 미삽입**, UI에서 “변경 없음” 안내)
3. `INSERT INTO parent_status_history (...)`
4. `UPDATE students SET parent_management_status = p_new_status, updated_at = now() WHERE id = p_student_id`
5. COMMIT

앱은 `students`의 status 컬럼을 **직접 UPDATE하지 않는다.** 항상 이 함수(또는 동일 로직의 RPC)만 호출.

### 학생 최초 생성 시

같은 트랜잭션에서:

1. `INSERT students` (`parent_management_status = 'unclassified'` 또는 지정값)
2. `INSERT parent_status_history` (초기 상태 1행)

→ “현재값만 있고 history가 비어 있는” 상태 방지.

### 대안 (보조)

- `students`에 대한 BEFORE UPDATE 트리거로 status 변경 시 history 강제 삽입 — 가능하나, reason을 트리거로 넘기기 어려워 **RPC 방식이 더 명확**.

---

## 1.5 Indexes

| Index | 목적 |
|-------|------|
| `idx_students_class_id` ON `students(class_id)` | 반별 목록 |
| `idx_students_parent_status` ON `students(parent_management_status)` | Attention 필터 |
| `idx_students_enrollment` ON `students(enrollment_status)` | 재원 필터 |
| `idx_focus_student_status` ON `current_focus_items(student_id, status, sort_order)` | 프로필 Focus |
| `idx_records_student_date` ON `records(student_id, record_date DESC)` | Timeline |
| `idx_records_date` ON `records(record_date DESC)` | Calendar / Dashboard |
| `idx_records_type` ON `records(record_type)` | Type 필터 |
| `idx_records_stamp_pending` ON `records(stamp_status)` WHERE `record_type = 'stamp' AND stamp_status = 'pending'` | Pending Stamps |
| `idx_records_important` ON `records(student_id)` WHERE `is_important = true` | Important only |
| `idx_record_tags_tag` ON `record_tags(tag_id)` | Tag 필터 |
| `idx_followups_status_due` ON `followups(status, due_date)` | Dashboard / Follow-ups |
| `idx_followups_record` ON `followups(record_id)` | Record 상세 |
| `idx_parent_history_student` ON `parent_status_history(student_id, changed_at DESC)` | 상태 이력 |

---

## 1.6 RLS 고려사항

| 항목 | MVP 정책 |
|------|----------|
| 익명 접근 | 금지 (`anon` SELECT/INSERT/UPDATE/DELETE deny) |
| 인증 | `authenticated`만 접근 |
| 개인용 MVP | 로그인 사용자 = 전체 데이터 접근 허용 (단일 instructor/admin) |
| 향후 Multi-user | `profiles.role` + 담당 class/student 매핑 테이블 추가 여지; MVP RLS를 “user_id = auth.uid()인 자신의 row만”으로 과도하게 좁히지 않되, **공개 테이블은 두지 않음** |
| Service Role | 브라우저/프론트에 **절대 노출 금지** |
| RPC | `change_parent_management_status`는 `SECURITY DEFINER` 사용 시 내부에서 `auth.uid()` 검증 필수 |

권장 패턴 (개념):

```text
ENABLE RLS on all app tables;
CREATE POLICY "authenticated_all" ON <table>
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

개인용 MVP에서 충분. Phase 2에서 class-scoped policy로 교체 가능.

---

## 1.7 Phase 2로 미룬 모듈 (스키마 미생성, 확장만 보장)

다음 테이블은 **MVP에 생성하지 않음.**

- `messages`, `message_targets`
- `meeting_notes` (+ work follow-ups)

확장 시 예상 연결:

- `message_targets.student_id` → `students`
- `message_targets.class_id` → `classes`
- `meeting_notes` ↔ students/classes (M:N 또는 jsonb는 추후 결정)

MVP의 `students` / `classes` / `records` PK를 안정적으로 유지하면 추가 시 마이그레이션으로 충분.

### Phase 2 TODO — Class History (반 이동 이력)

**구현됨 (003_terms_and_class_history):** `terms`, `classes.term_id`, `student_class_history`,
`change_student_class` RPC, Profile Class History UI.

남아 있는 관련 확장 (이번 범위 밖):

- Before Class briefing
- 학기 전환 마법사(일괄 진급 UI)

---

## 1.8 명시적 비저장 (계속 제외)

- CQ 점수, 단어시험 점수
- 보강 일정 (Makeup Scheduler 영역)
- Dream Tree 실행/발송 정기 체크
- 교재 검수 등 통관 행정 체크
- 심리진단·자동판정 점수

점수가 아니라 **패턴/맥락**은 `records` (Observation/Guidance 등)로만 기록.

---

# 2. 관계도 (MVP Tables)

```text
auth.users
    │
    └──< profiles

classes
    │
    └──< students >────── parent_status_history
            │                    (N history rows per student)
            │
            ├──< current_focus_items >──? tags   (optional tag_id)
            │
            └──< records
                    │
                    ├──< record_tags >── tags
                    │
                    └──< followups          (1 record : N followups)

Stamp = records WHERE record_type = 'stamp'
```

Cardinality 요약:

| From | To | Card |
|------|-----|------|
| classes | students | 1:N |
| students | current_focus_items | 1:N |
| students | records | 1:N |
| students | parent_status_history | 1:N |
| records | record_tags | 1:N |
| tags | record_tags | 1:N |
| records | followups | **1:N** |
| current_focus_items | tags | N:0..1 (optional) |

동일 데이터의 재구성 View (앱 레이어):

```text
Dashboard  ← records + followups + stamps(pending) + students
Students   ← students (+ class, aggregates)
Profile    ← student + focus + history + records + followups
Calendar   ← records by record_date
Follow-ups ← followups (+ parent record/student)
```

---

# 3. Seed Data 설계

## 3.1 Tags (초기 고정 세트)

| category | name | sort_order |
|----------|------|------------|
| `academic` | Vocabulary | 10 |
| `academic` | Grammar | 20 |
| `academic` | Reading | 30 |
| `academic` | Speaking | 40 |
| `academic` | Writing | 50 |
| `academic` | Phonics | 60 |
| `learning_management` | Homework | 70 |
| `learning_management` | Study Habit | 80 |
| `classroom_state` | Attitude | 90 |
| `classroom_state` | Concentration | 100 |
| `classroom_state` | Confidence | 110 |
| `classroom_state` | Emotional | 120 |

- UUID는 seed 시 고정 또는 생성 후 앱 상수에 매핑.
- Custom Tag 추가는 Phase 2; MVP는 seed + `is_active`로 충분.

## 3.2 Record Types

DB 테이블로 두지 않음. **앱 상수 + CHECK**로 관리.

| code | label_ko |
|------|----------|
| observation | 관찰 |
| guidance | 지도 |
| parent_contact | 학부모 소통 |
| positive_note | 긍정적 기록 |
| stamp | 스탬프 |
| general_note | 일반 메모 |

## 3.3 Parent Management Status

DB lookup 테이블 없이 **앱 상수 + CHECK**.

| code | label_ko | 기본값 |
|------|----------|--------|
| unclassified | 미분류 | 학생 생성 시 기본 |
| stable | 지속 | |
| intensive_care | 집중 | |
| retention_risk | 장기위험생 | |
| temporary_leave | 구간장기 | |
| withdrawn | 장기 | |

## 3.4 Enrollment Status

| code | label_ko |
|------|----------|
| active | 재원 |
| inactive | 비활성 |
| withdrawn | 퇴원 |

## 3.5 Classes / Students

- **Classes:** 실제 반 이름은 사용자가 등록. Seed는 빈 상태 또는 개발용 예시 1~2개만.
- **Students:** 운영 seed 없음. 개발/데모용 샘플은 별도 `seed_dev`로 분리 권장.

## 3.6 Profiles

- 최초 로그인 시 `auth.users` 트리거로 `profiles` row 자동 생성 권장.

---

# 4. 페이지별 Wireframe (텍스트)

공통 Chrome (모든 인증 화면):

```text
┌─────────────────────────────────────────────────────────────┐
│ Student Hub          [Dashboard] [Students] [Calendar]      │
│                      [Follow-ups]              [+ Quick Record] [User] │
└─────────────────────────────────────────────────────────────┘
```

---

## 4.1 Dashboard (`/dashboard`)

```text
┌─ Dashboard ─────────────────────────────────────────────────┐
│                                                             │
│  [ Students: N ]  [ Today's Records: N ]                    │
│  [ Open Follow-ups: N ]  [ Pending Stamps: N ]              │
│  ※ 행동으로 이어지는 KPI만. 장식 통계 없음.                    │
│                                                             │
│  ┌─ Today's Follow-ups ─────────┐  ┌─ Pending Stamps ─────┐ │
│  │ due today / overdue 우선      │  │ 학생 · +N · reason   │ │
│  │ 학생명 · note · due           │  │ [Mark Given]         │ │
│  │ [Open Profile] [Done]         │  └─────────────────────┘ │
│  └──────────────────────────────┘                           │
│                                                             │
│  ┌─ Recent Activity ──────────────────────────────────────┐ │
│  │ 날짜 · 학생 · Type · tags · content snippet            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Students Needing Attention ─┐  ┌─ Mini Calendar ─────┐ │
│  │ 집중/장기위험생 등             │  │ 월 그리드            │ │
│  │ 또는 open follow-up 있는 학생  │  │ 기록 있는 날 표시    │ │
│  └──────────────────────────────┘  │ 클릭 → Calendar     │ │
│                                    └─────────────────────┘ │
│                                                             │
│  ┌─ Current Focus Overview (요약) ────────────────────────┐ │
│  │ 학생 · open focus titles (최대 몇 명만)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**미배치 (Phase 2):** Review Queue, Work Follow-ups, Messages, Meeting Notes, Before Class

---

## 4.2 Students (`/students`)

```text
┌─ Students ──────────────────────────────────────────────────┐
│  [+ Add Student]                                            │
│                                                             │
│  Filters: [Class ▾] [Level] [Enrollment ▾]                  │
│           [Parent Status ▾] [Enrollment ▾]  [Search name]  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 한글명 / 영문명 │ 반 │ 레벨 │ 요일·교시 │ 재원 │ 학부모상태 │ │
│  │ Open FU │ Pending Stamp │ Last Record │                 │ │
│  │ (행 클릭 → Profile)                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 4.3 Student Profile (`/students/[id]`)

```text
┌─ Student Profile ───────────────────────────────────────────┐
│  김도연 / Doyeon Kim                                        │
│  DSC1 · Level X · Mon/Wed · Period 2                        │
│  Enrollment: active    Parent: [지속 ▾] [이력 보기]          │
│                                                             │
│  Open Follow-ups: 2   Pending Stamps: 1   Last Record: 8/10 │
│                                                             │
│  ┌─ Current Focus ──────────────────────── [+ Add Focus] ─┐ │
│  │ 1. Vocabulary — 단어 암기 방식 지속 관찰    [Done] [⋮] │ │
│  │ 2. Homework — 방학 이후 수행 흐름 확인      [Done] [⋮] │ │
│  │ 3. Confidence — 자발적 참여 증가            [Done] [⋮] │ │
│  │ (title + note; optional tag 연결은 편집 UI에서)         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Timeline Filters:                                          │
│  [All] [Observation] [Guidance] [Parent] [Positive]         │
│  [Stamp] [General]   Tags: [multi]   [★ Important only]     │
│                                                             │
│  ┌─ Timeline ─────────────────────────────────────────────┐ │
│  │ 8/10 · Observation · Homework                          │ │
│  │   content…  ★  Follow-ups: 1 open                      │ │
│  │ 8/10 · Guidance · Homework                             │ │
│  │ 8/08 · Stamp +2 · Pending           [Mark Given]       │ │
│  │ …                                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  (Drawer/Modal) Parent Status History:                      │
│  6/1 지속 → 7/20 집중 (reason) → 8/15 지속 (reason)        │
└─────────────────────────────────────────────────────────────┘
```

**미배치 (향후):** Messages, Cases, Learning & Behavior Profile

---

## 4.4 Calendar (`/calendar`)

```text
┌─ Calendar ──────────────────────────────────────────────────┐
│  ◀  August 2026  ▶                                          │
│                                                             │
│  ┌──┬──┬──┬──┬──┬──┬──┐                                     │
│  │Su│Mo│Tu│We│Th│Fr│Sa│                                     │
│  ├──┼──┼──┼──┼──┼──┼──┤                                     │
│  │  │  │  │  │  │1 │2 │  ← 점에 Record 수 표시              │
│  │… │… │… │10│… │… │… │                                     │
│  └──┴──┴──┴──┴──┴──┴──┘                                     │
│                                                             │
│  Selected: Aug 10                                           │
│  ┌─ Day Records ──────────────────────────────────────────┐ │
│  │ 김도연 — Observation / Homework                        │ │
│  │ 박시율 — Guidance                                      │ │
│  │ 이하윤 — Stamp +2                                      │ │
│  │ … — Positive Note                                      │ │
│  │ (항목 클릭 → Profile 해당 구간 또는 상세)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

가로로 긴 스프레드시트 UI 금지. 월간 캘린더 + 일자 리스트.

---

## 4.5 Follow-ups (`/follow-ups`)

```text
┌─ Follow-ups ────────────────────────────────────────────────┐
│  Tabs: [Open] [Due Today] [Overdue] [Done]                  │
│  Filters: [Student] [Class] [Date range]                    │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Due │ Student │ Note │ From Record (type · date · snip)│ │
│  │     │         │      │ [Profile] [Mark Done]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ※ Student Follow-up만. Work Follow-up은 Phase 2.           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4.6 Quick Record (전역 Modal)

```text
┌─ Quick Record ──────────────────────┐
│  Student *        [search ▾]        │
│  Date *           [today]           │
│  Record Type *    [Observation ▾]   │
│  Tags             [multi select]    │
│  Content *        [textarea]        │
│  ☐ Important                        │
│  ☐ Add Follow-up                    │
│     (on) Due Date, Follow-up Note   │
│     ※ 한 Record에 Follow-up 여러 개 │
│       추가는 "Add another" 가능     │
│                                     │
│  — if Parent Contact —              │
│  Contact Method   [phone ▾]         │
│                                     │
│  — if Stamp —                       │
│  Amount *  Content*=사유  Status [Pend] │
│                                     │
│           [Cancel]  [Save]          │
└─────────────────────────────────────┘
```

제목(Title) 필드 없음.

---

# 5. 핵심 User Flow

## 5.1 Quick Record 작성

1. 어느 화면에서든 `+ Quick Record` 클릭  
2. 학생 선택 (필수), 날짜 기본=오늘, Type 선택, Tags 선택(선택), Content 입력  
3. 필요 시 Important 토글  
4. Type별: Parent Contact → contact_method / Stamp → amount·reason·status  
5. Follow-up 필요 시 체크 → due_date + note; **추가 Follow-up**이면 동일 Record에 N행 생성  
6. Save → `records` INSERT (+ `record_tags`, + `followups` N)  
7. 성공 시 Modal 닫힘; Dashboard Recent / Profile Timeline / Calendar에 즉시 반영  

**목표:** 일반 메모 ~10초.

## 5.2 Current Focus 등록

1. Student Profile → Current Focus → `+ Add Focus`  
2. `title` 필수, `note` 선택, `tag_id` 선택(선택), `sort_order` 조정  
3. Save → `current_focus_items` INSERT (`status=open`)  
4. 프로필 상단·Dashboard Focus Overview에 표시  
5. 완료 시 `status=done`, `completed_at` 설정 (삭제 대신 완료 권장; 삭제는 실수 방지용 soft 정책 가능)  

**주의:** Focus title을 Tag로 강제하지 않음. Tag 연결은 선택.

## 5.3 Parent Status 변경

1. Profile 상단 Parent Status 드롭다운에서 새 상태 선택  
2. Reason/메모 입력 (권장; 필수 여부는 제품 정책)  
3. Confirm → **오직** `change_parent_management_status` RPC 호출  
4. 트랜잭션: history INSERT + `students.parent_management_status` UPDATE  
5. UI 갱신: 배지 변경 + History 목록에 새 행  
6. `students` status 직접 UPDATE하는 코드 경로 없음  

## 5.4 Follow-up 완료

1. Dashboard / Follow-ups / Profile Timeline에서 open Follow-up 확인  
2. `Mark Done`  
3. `followups` UPDATE: `status=done`, `completed_at=now()`  
4. Record·과거 Follow-up 내용 삭제/덮어쓰기 없음  
5. Open/Overdue 카운트 감소; Done 탭에서 이력 조회 가능  

## 5.5 Stamp 지급

1. Quick Record로 Stamp 생성 (`stamp_status=pending`) 또는 기존 Pending 확인  
2. Dashboard Pending Stamps / Profile Timeline에서 해당 Stamp 선택  
3. `Mark Given` → `stamp_status=given`, `stamp_given_at=오늘(또는 지정일)`  
4. Pending 목록에서 제거; Timeline에는 Given으로 남음  
5. “왜 몇 개를 주기로 했는지”는 `stamp_amount` + `content`(사유)로 보존  

---

# 6. 구현 순서 (코딩 시작 시 권장)

기존 기능을 덜 깨뜨리도록 **아래에서 위로, 데이터 → 읽기 → 쓰기 → 워크플로**.

| Step | 작업 | 이유 |
|------|------|------|
| 1 | 프로젝트 골격 + Supabase 연결 + Auth + `profiles` | 이후 모든 화면의 전제 |
| 2 | Schema 적용: `classes`, `students`, `tags`, `records`, `record_tags`, `current_focus_items`, `followups`, `parent_status_history` + CHECK/Index/RLS | 앱 전에 Source of Truth 고정 |
| 3 | Seed: tags + (선택) 개발용 class/student | UI 드롭다운·필터 동작 |
| 4 | RPC: `change_parent_management_status` + 학생 생성 시 초기 history | Status 불일치 방지 로직을 최초부터 강제 |
| 5 | Students 목록 + 등록/수정 (enrollment, class 등) | 앵커 엔티티 |
| 6 | Student Profile 읽기 전용 헤더 (이름·반·상태 표시) | 이후 Timeline 부착점 |
| 7 | Quick Record 작성 (6 Type, Tags, Important, Stamp/Parent 조건부 필드) | 핵심 쓰기 경로 |
| 8 | Profile Timeline + Type/Tag/Important 필터 | Student Reconstruction (기준 A) |
| 9 | Current Focus CRUD (복수 item) | 헤더 완성 |
| 10 | Parent Status 변경 UI → RPC만 사용 + History 패널 | 원자 변경 UX |
| 11 | Follow-up: Quick Record에서 N개 생성 + 목록/완료 | Action Management |
| 12 | Stamp Pending → Given 워크플로 | Dashboard·Profile 연동 |
| 13 | Calendar (월간 + 일자 Record 리스트) | Date Reconstruction |
| 14 | Dashboard 패널 (KPI + Today FU + Pending Stamp + Recent + Attention + Mini Cal + Focus 요약) | 진입점 완성 |
| 15 | Follow-ups 전용 페이지 (Open/Due/Overdue/Done) | 기준 B에 가까운 운영면 |
| 16 | (선택) JSON Backup/Export | 명세 MVP 데이터 항목 |
| 17 | 검증 시나리오 A~G 수동 QA | 명세 §48 |
| — | Message / Meeting / Before Class / Class History 등 | **Phase 2** |

### 순서 상의 금지 사항

- Phase 2/3 UI를 Step 1~15에 끼워 넣지 않음  
- `parent_record_id` 등 예약 컬럼을 “나중에 쓰려고” 미리 넣지 않음  
- Parent status를 클라이언트에서 `students`만 업데이트하지 않음  
- Tag boolean 컬럼·Type별 테이블 분기 스키마로 가지 않음  
- `students.is_active` / `stamp_reason` 재도입 금지 (`enrollment_status` / `content`로 일원화)  

---

# 7. 설계 검토 체크리스트 (구현 승인 전)

- [ ] Message/Meeting이 MVP에 없는가?  
- [ ] Follow-up이 Record 1:N인가?  
- [ ] 미확정 예약 컬럼이 Schema에 없는가?  
- [ ] Parent Status 변경이 RPC/단일 트랜잭션인가?  
- [ ] Current Focus가 Tag와 분리되어 있는가?  
- [ ] CQ·단어시험·보강·Dream Tree 체크·교재검수가 Schema/화면에 없는가?  
- [ ] Wireframe 5화면 + Quick Record로 기준 A(복구) / 주요 Action이 커버되는가?  

---

**다음 단계:** 이 문서 검토·수정 합의 후, 별도 승인 시에만 SQL migration 및 애플리케이션 코드 구현을 시작한다.
