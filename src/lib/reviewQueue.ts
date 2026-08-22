import {
  REVIEW_MANAGEMENT_RECORD_TYPES,
  REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS,
  REVIEW_PARENT_CONTACT_WITHOUT_FOLLOWUP_DAYS,
  REVIEW_STALE_FOCUS_DAYS,
  REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS,
  daysBetweenISO,
  toLocalDateISO,
  type ReviewRuleType,
} from './constants'
import type {
  CurrentFocusItem,
  Followup,
  ParentManagementStatus,
  RecordRow,
  Student,
} from './types'

export type ReviewSourceType = 'focus' | 'record' | 'student'

export interface ReviewActionRow {
  id: string
  user_id: string
  student_id: string
  rule_type: ReviewRuleType
  source_type: ReviewSourceType
  source_id: string | null
  trigger_key: string
  action: 'dismissed' | 'snoozed'
  snoozed_until: string | null
  created_at: string
  updated_at: string
}

export interface ReviewItem {
  id: string
  triggerKey: string
  ruleType: ReviewRuleType
  student: Student
  sourceType: ReviewSourceType
  sourceId: string | null
  ageDays: number
  title: string
  detail: string
  focus?: CurrentFocusItem
  record?: RecordRow
  lastRecord?: RecordRow | null
}

export interface ReviewStudentGroup {
  student: Student
  items: ReviewItem[]
  maxAgeDays: number
}

function recordHasOpenFollowup(record: RecordRow): boolean {
  return (record.followups ?? []).some((f: Followup) => f.status === 'open')
}

function isManagementRecord(r: RecordRow): boolean {
  return REVIEW_MANAGEMENT_RECORD_TYPES.includes(r.record_type)
}

/** True if `later` is strictly after `earlier` by record_date, then created_at. */
function isAfterRecord(later: RecordRow, earlier: RecordRow): boolean {
  if (later.record_date !== earlier.record_date) {
    return later.record_date > earlier.record_date
  }
  return later.created_at > earlier.created_at
}

function hasSubsequentManagement(records: RecordRow[], anchor: RecordRow): boolean {
  return records.some(
    (r) => r.id !== anchor.id && isManagementRecord(r) && isAfterRecord(r, anchor),
  )
}

function buildStaleFocusItems(
  student: Student,
  focusItems: CurrentFocusItem[],
  asOfDate: string,
): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const focus of focusItems) {
    if (focus.status !== 'open') continue
    const start = toLocalDateISO(focus.created_at)
    const age = daysBetweenISO(start, asOfDate)
    if (age < REVIEW_STALE_FOCUS_DAYS) continue
    out.push({
      id: `stale_focus:${focus.id}`,
      triggerKey: `stale_focus:${focus.id}`,
      ruleType: 'stale_focus',
      student,
      sourceType: 'focus',
      sourceId: focus.id,
      ageDays: age,
      title: `Current Focus · ${age}일 경과`,
      detail: focus.note
        ? `${focus.title} — ${focus.note}`
        : focus.title,
      focus,
    })
  }
  return out
}

function buildObservationItems(
  student: Student,
  records: RecordRow[],
  asOfDate: string,
): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const rec of records) {
    if (rec.record_type !== 'observation') continue
    const age = daysBetweenISO(rec.record_date, asOfDate)
    if (age < REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS) continue
    // Explicit open Follow-up on this Observation → skip (avoid duplicate with Follow-ups page)
    if (recordHasOpenFollowup(rec)) continue
    if (hasSubsequentManagement(records, rec)) continue
    out.push({
      id: `observation_without_followup:${rec.id}`,
      triggerKey: `observation_without_followup:${rec.id}`,
      ruleType: 'observation_without_followup',
      student,
      sourceType: 'record',
      sourceId: rec.id,
      ageDays: age,
      title: `Observation 후 후속 기록 없음 · ${age}일`,
      detail: rec.content,
      record: rec,
    })
  }
  return out
}

function buildParentContactItems(
  student: Student,
  records: RecordRow[],
  asOfDate: string,
): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const rec of records) {
    if (rec.record_type !== 'parent_contact') continue
    const age = daysBetweenISO(rec.record_date, asOfDate)
    if (age < REVIEW_PARENT_CONTACT_WITHOUT_FOLLOWUP_DAYS) continue
    if (recordHasOpenFollowup(rec)) continue
    if (hasSubsequentManagement(records, rec)) continue
    out.push({
      id: `parent_contact_without_followup:${rec.id}`,
      triggerKey: `parent_contact_without_followup:${rec.id}`,
      ruleType: 'parent_contact_without_followup',
      student,
      sourceType: 'record',
      sourceId: rec.id,
      ageDays: age,
      title: `Parent Contact 후 확인 기록 없음 · ${age}일`,
      detail: rec.content,
      record: rec,
    })
  }
  return out
}

function buildNoRecentRecordItem(
  student: Student,
  records: RecordRow[],
  classStartDate: string | null,
  asOfDate: string,
): ReviewItem | null {
  const created = toLocalDateISO(student.created_at)
  const baseline = [created, classStartDate].filter(Boolean).sort().pop() as string
  const eligibleAge = daysBetweenISO(baseline, asOfDate)
  if (eligibleAge < REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS) return null

  const sorted = [...records].sort((a, b) => {
    if (a.record_date !== b.record_date) return b.record_date.localeCompare(a.record_date)
    return b.created_at.localeCompare(a.created_at)
  })
  const last = sorted[0] ?? null

  if (last) {
    const age = daysBetweenISO(last.record_date, asOfDate)
    if (age < REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS) return null
    return {
      id: `student_without_recent_record:${student.id}:${last.id}`,
      triggerKey: `student_without_recent_record:${student.id}:${last.id}`,
      ruleType: 'student_without_recent_record',
      student,
      sourceType: 'student',
      sourceId: student.id,
      ageDays: age,
      title: `최근 기록 없음 · ${age}일`,
      detail: `Last Record ${last.record_date} · ${last.record_type}`,
      lastRecord: last,
    }
  }

  return {
    id: `student_without_recent_record:${student.id}:none`,
    triggerKey: `student_without_recent_record:${student.id}:none`,
    ruleType: 'student_without_recent_record',
    student,
    sourceType: 'student',
    sourceId: student.id,
    ageDays: eligibleAge,
    title: `기록 없음 · ${eligibleAge}일`,
    detail: '아직 저장된 Record가 없습니다.',
    lastRecord: null,
  }
}

export function computeReviewItems(input: {
  students: Student[]
  focusByStudent: Map<string, CurrentFocusItem[]>
  recordsByStudent: Map<string, RecordRow[]>
  classStartByStudent: Map<string, string | null>
  asOfDate: string
  currentTermClassIds: Set<string>
}): ReviewItem[] {
  const items: ReviewItem[] = []

  for (const student of input.students) {
    if (student.enrollment_status !== 'active') continue
    if (!student.class_id || !input.currentTermClassIds.has(student.class_id)) continue

    const focus = input.focusByStudent.get(student.id) ?? []
    const records = input.recordsByStudent.get(student.id) ?? []
    const classStart = input.classStartByStudent.get(student.id) ?? null

    items.push(...buildStaleFocusItems(student, focus, input.asOfDate))
    items.push(...buildObservationItems(student, records, input.asOfDate))
    items.push(...buildParentContactItems(student, records, input.asOfDate))
    const noRecent = buildNoRecentRecordItem(
      student,
      records,
      classStart,
      input.asOfDate,
    )
    if (noRecent) items.push(noRecent)
  }

  return items
}

export function isReviewHiddenByAction(
  item: ReviewItem,
  actionsByKey: Map<string, ReviewActionRow>,
  asOfDate: string,
): boolean {
  const action = actionsByKey.get(item.triggerKey)
  if (!action) return false
  if (action.action === 'dismissed') return true
  if (action.action === 'snoozed' && action.snoozed_until) {
    return action.snoozed_until >= asOfDate
  }
  return false
}

export function filterActiveReviews(
  items: ReviewItem[],
  actions: ReviewActionRow[],
  asOfDate: string,
): ReviewItem[] {
  const map = new Map(actions.map((a) => [a.trigger_key, a]))
  return items.filter((item) => !isReviewHiddenByAction(item, map, asOfDate))
}

function managementRank(status: ParentManagementStatus): number {
  if (status === 'retention_risk') return 0
  if (status === 'intensive_care') return 1
  return 2
}

export function compareReviewItems(a: ReviewItem, b: ReviewItem): number {
  if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays
  const mr = managementRank(a.student.parent_management_status)
  const nr = managementRank(b.student.parent_management_status)
  if (mr !== nr) return mr - nr
  return a.student.korean_name.localeCompare(b.student.korean_name, 'ko')
}

export function groupReviewsByStudent(items: ReviewItem[]): ReviewStudentGroup[] {
  const map = new Map<string, ReviewStudentGroup>()
  for (const item of items) {
    const existing = map.get(item.student.id)
    if (existing) {
      existing.items.push(item)
      existing.maxAgeDays = Math.max(existing.maxAgeDays, item.ageDays)
    } else {
      map.set(item.student.id, {
        student: item.student,
        items: [item],
        maxAgeDays: item.ageDays,
      })
    }
  }

  const groups = [...map.values()]
  for (const g of groups) {
    g.items.sort(compareReviewItems)
  }
  groups.sort((a, b) => {
    if (b.maxAgeDays !== a.maxAgeDays) return b.maxAgeDays - a.maxAgeDays
    const mr = managementRank(a.student.parent_management_status)
    const nr = managementRank(b.student.parent_management_status)
    if (mr !== nr) return mr - nr
    return a.student.korean_name.localeCompare(b.student.korean_name, 'ko')
  })
  return groups
}

export function summarizeReviews(items: ReviewItem[]): Record<ReviewRuleType | 'all', number> {
  const summary: Record<ReviewRuleType | 'all', number> = {
    all: items.length,
    stale_focus: 0,
    observation_without_followup: 0,
    parent_contact_without_followup: 0,
    student_without_recent_record: 0,
  }
  for (const item of items) {
    summary[item.ruleType] += 1
  }
  return summary
}
