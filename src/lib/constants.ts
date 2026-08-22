import type {
  ContactMethod,
  EnrollmentStatus,
  ParentManagementStatus,
  RecordType,
  TagCategory,
} from './types'

export const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: 'observation', label: '관찰' },
  { value: 'guidance', label: '지도' },
  { value: 'parent_contact', label: '학부모 소통' },
  { value: 'positive_note', label: '긍정적 기록' },
  { value: 'stamp', label: '스탬프' },
  { value: 'general_note', label: '일반 메모' },
]

export const ENROLLMENT_STATUSES: { value: EnrollmentStatus; label: string }[] = [
  { value: 'active', label: '재원' },
  { value: 'inactive', label: '비활성' },
  { value: 'withdrawn', label: '퇴원' },
]

export const PARENT_STATUSES: { value: ParentManagementStatus; label: string }[] = [
  { value: 'unclassified', label: '미분류' },
  { value: 'stable', label: '지속' },
  { value: 'intensive_care', label: '집중' },
  { value: 'retention_risk', label: '장기위험생' },
  { value: 'temporary_leave', label: '구간장기' },
  { value: 'withdrawn', label: '장기' },
  { value: 'new_student', label: '신규' },
]

/** UI display label — DB field remains parent_management_status */
export const MANAGEMENT_STATUS_LABEL = '관리상태'

export type AccentColor =
  | 'blue'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'yellow'
  | 'pink'
  | 'gray'

export const TAG_CATEGORY_LABELS: { value: TagCategory; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'learning_management', label: 'Management' },
  { value: 'classroom_state', label: 'Student State' },
]

export const ACCENT_COLORS: { value: AccentColor | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
  { value: 'teal', label: 'Teal' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'pink', label: 'Pink' },
  { value: 'gray', label: 'Gray' },
]

export const ATTENTION_PARENT_STATUSES: ParentManagementStatus[] = [
  'intensive_care',
  'retention_risk',
]

/** Before Class: Important Record lookback window (days, inclusive of as-of date) */
export const IMPORTANT_RECORD_LOOKBACK_DAYS = 7

/** Review Queue thresholds (days) — change here for future settings */
export const REVIEW_STALE_FOCUS_DAYS = 14
export const REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS = 14
export const REVIEW_PARENT_CONTACT_WITHOUT_FOLLOWUP_DAYS = 14
export const REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS = 21

export const REVIEW_SNOOZE_OPTIONS_DAYS = [3, 7, 14] as const

export type ReviewRuleType =
  | 'stale_focus'
  | 'observation_without_followup'
  | 'parent_contact_without_followup'
  | 'student_without_recent_record'

export const REVIEW_RULE_LABELS: { value: ReviewRuleType; label: string; short: string }[] = [
  { value: 'stale_focus', label: '오래된 Focus', short: 'Focus' },
  {
    value: 'observation_without_followup',
    label: 'Observation 후 후속 기록 없음',
    short: 'Observation',
  },
  {
    value: 'parent_contact_without_followup',
    label: 'Parent Contact 후 확인 기록 없음',
    short: 'Parent Contact',
  },
  {
    value: 'student_without_recent_record',
    label: '최근 기록 없음',
    short: 'No Recent Record',
  },
]

/**
 * Record types that count as management follow-through after Observation / Parent Contact.
 * Stamp / Positive Note alone do not clear those reviews.
 */
export const REVIEW_MANAGEMENT_RECORD_TYPES: RecordType[] = [
  'observation',
  'guidance',
  'parent_contact',
  'general_note',
]

export type MessagePurpose =
  | 'dream_tree'
  | 'general_notice'
  | 'homework'
  | 'test'
  | 'level_test'
  | 'information_session'
  | 'consultation'
  | 'individual_feedback'
  | 'praise'
  | 'management'
  | 'other'

export const MESSAGE_PURPOSES: { value: MessagePurpose; label: string }[] = [
  { value: 'dream_tree', label: 'Dream Tree' },
  { value: 'general_notice', label: '전체 공지' },
  { value: 'homework', label: '숙제' },
  { value: 'test', label: '시험' },
  { value: 'level_test', label: '레벨테스트' },
  { value: 'information_session', label: '설명회' },
  { value: 'consultation', label: '상담' },
  { value: 'individual_feedback', label: '개별 피드백' },
  { value: 'praise', label: '칭찬' },
  { value: 'management', label: '관리' },
  { value: 'other', label: '기타' },
]

export type WorkNoteType =
  | 'faculty_meeting'
  | 'approval'
  | 'team_leader'
  | 'deputy_director'
  | 'instruction'
  | 'general'

export const WORK_NOTE_TYPES: { value: WorkNoteType; label: string }[] = [
  { value: 'faculty_meeting', label: '교무회의' },
  { value: 'approval', label: '결재' },
  { value: 'team_leader', label: '팀장 전달' },
  { value: 'deputy_director', label: '부원장 전달' },
  { value: 'instruction', label: '업무 지시' },
  { value: 'general', label: '일반 메모' },
]

export const WORK_NOTE_STATUSES: { value: 'open' | 'done'; label: string }[] = [
  { value: 'open', label: '진행/확인 필요' },
  { value: 'done', label: '완료' },
]

export type CaseStatus = 'open' | 'monitoring' | 'resolved' | 'closed'
export type CasePriority = 'low' | 'normal' | 'high'
export type CaseType =
  | 'learning'
  | 'homework'
  | 'vocabulary'
  | 'class_participation'
  | 'behavior'
  | 'emotional'
  | 'parent_communication'
  | 'attendance'
  | 'other'

export const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: 'open', label: '진행중' },
  { value: 'monitoring', label: '관찰중' },
  { value: 'resolved', label: '해결' },
  { value: 'closed', label: '종료' },
]

export const CASE_PRIORITIES: { value: CasePriority; label: string }[] = [
  { value: 'low', label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
]

export const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: 'learning', label: '학습' },
  { value: 'homework', label: '숙제' },
  { value: 'vocabulary', label: '단어' },
  { value: 'class_participation', label: '수업 참여' },
  { value: 'behavior', label: '행동' },
  { value: 'emotional', label: '정서' },
  { value: 'parent_communication', label: '학부모 소통' },
  { value: 'attendance', label: '출결' },
  { value: 'other', label: '기타' },
]

export const ACTIVE_CASE_STATUSES: CaseStatus[] = ['open', 'monitoring']

export type HypothesisConfidence = 'low' | 'medium' | 'high'
export type HypothesisStatus = 'active' | 'supported' | 'unsupported' | 'closed'
export type InterventionType =
  | 'prompting'
  | 'modeling'
  | 'scaffolding'
  | 'positive_reinforcement'
  | 'choice'
  | 'goal_setting'
  | 'study_strategy'
  | 'environmental_change'
  | 'retrieval_practice'
  | 'direct_instruction'
  | 'emotional_support'
  | 'other'
export type ResponseType = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unclear'

export const HYPOTHESIS_CONFIDENCE: { value: HypothesisConfidence; label: string }[] = [
  { value: 'low', label: '낮음 (Low)' },
  { value: 'medium', label: '보통 (Medium)' },
  { value: 'high', label: '높음 (High)' },
]

export const HYPOTHESIS_STATUSES: { value: HypothesisStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'supported', label: 'Supported' },
  { value: 'unsupported', label: 'Unsupported' },
  { value: 'closed', label: 'Closed' },
]

export const INTERVENTION_TYPES: { value: InterventionType; label: string }[] = [
  { value: 'prompting', label: 'Prompting' },
  { value: 'modeling', label: 'Modeling' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'positive_reinforcement', label: 'Positive Reinforcement' },
  { value: 'choice', label: 'Choice' },
  { value: 'goal_setting', label: 'Goal Setting' },
  { value: 'study_strategy', label: 'Study Strategy' },
  { value: 'environmental_change', label: 'Environmental Change' },
  { value: 'retrieval_practice', label: 'Retrieval Practice' },
  { value: 'direct_instruction', label: 'Direct Instruction' },
  { value: 'emotional_support', label: 'Emotional Support' },
  { value: 'other', label: '기타' },
]

export const RESPONSE_TYPES: { value: ResponseType; label: string }[] = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'unclear', label: 'Unclear' },
]

export const CONTACT_METHODS: { value: ContactMethod; label: string }[] = [
  { value: 'phone', label: '전화' },
  { value: 'message', label: '문자' },
  { value: 'in_person', label: '대면' },
  { value: 'other', label: '기타' },
]

export function labelOf<T extends string>(
  list: { value: T; label: string }[],
  value: T,
): string {
  return list.find((x) => x.value === value)?.label ?? value
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Subtract calendar days from a local YYYY-MM-DD (avoids UTC day-shift). */
export function daysBeforeISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Add calendar days to a local YYYY-MM-DD. */
export function daysAfterISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Format YYYY-MM-DD for compact UI (e.g. 8/15). */
export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${Number(parts[1])}/${Number(parts[2])}`
}

/** Whole calendar days between two YYYY-MM-DD values (local). */
export function daysBetweenISO(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number)
  const [y2, m2, d2] = toISO.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.floor((b - a) / 86400000)
}

/** Date part of timestamptz / ISO string as local YYYY-MM-DD. */
export function toLocalDateISO(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
