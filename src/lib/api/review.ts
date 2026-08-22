import { supabase } from '../supabase'
import {
  computeReviewItems,
  filterActiveReviews,
  groupReviewsByStudent,
  summarizeReviews,
  type ReviewActionRow,
  type ReviewItem,
  type ReviewStudentGroup,
} from '../reviewQueue'
import type { ReviewRuleType } from '../constants'
import type { CurrentFocusItem, RecordRow } from '../types'
import { fetchCurrentTerm } from './terms'
import { fetchClasses } from './classes'
import { fetchStudents } from './students'

export interface ReviewQueuePayload {
  items: ReviewItem[]
  groups: ReviewStudentGroup[]
  summary: ReturnType<typeof summarizeReviews>
}

export async function fetchReviewActions(userId: string): Promise<ReviewActionRow[]> {
  const { data, error } = await supabase
    .from('review_actions')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as ReviewActionRow[]
}

export async function upsertReviewAction(input: {
  user_id: string
  student_id: string
  rule_type: ReviewRuleType
  source_type: 'focus' | 'record' | 'student'
  source_id: string | null
  trigger_key: string
  action: 'dismissed' | 'snoozed'
  snoozed_until: string | null
}): Promise<void> {
  const { error } = await supabase.from('review_actions').upsert(
    {
      user_id: input.user_id,
      student_id: input.student_id,
      rule_type: input.rule_type,
      source_type: input.source_type,
      source_id: input.source_id,
      trigger_key: input.trigger_key,
      action: input.action,
      snoozed_until: input.snoozed_until,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,trigger_key' },
  )
  if (error) throw error
}

/** Build Review Queue from existing data + teacher actions. No attention boolean stored. */
export async function fetchReviewQueue(
  userId: string,
  asOfDate: string,
): Promise<ReviewQueuePayload> {
  const currentTerm = await fetchCurrentTerm()
  const termClasses = currentTerm ? await fetchClasses(currentTerm.id) : []
  const currentTermClassIds = new Set(termClasses.map((c) => c.id))

  const students = (await fetchStudents()).filter(
    (s) =>
      s.enrollment_status === 'active' &&
      s.class_id &&
      currentTermClassIds.has(s.class_id),
  )

  if (students.length === 0) {
    return {
      items: [],
      groups: [],
      summary: summarizeReviews([]),
    }
  }

  const ids = students.map((s) => s.id)

  const [
    { data: focusRows, error: focusErr },
    { data: recordRows, error: recordErr },
    { data: historyRows, error: histErr },
    actions,
  ] = await Promise.all([
    supabase
      .from('current_focus_items')
      .select('*')
      .in('student_id', ids)
      .eq('status', 'open'),
    supabase
      .from('records')
      .select(
        `
        *,
        record_tags(tag_id, tags(*)),
        followups(*)
      `,
      )
      .in('student_id', ids)
      .order('record_date', { ascending: false }),
    supabase
      .from('student_class_history')
      .select('student_id, start_date, is_current')
      .in('student_id', ids)
      .eq('is_current', true),
    fetchReviewActions(userId),
  ])
  if (focusErr) throw focusErr
  if (recordErr) throw recordErr
  if (histErr) throw histErr

  const focusByStudent = new Map<string, CurrentFocusItem[]>()
  for (const row of focusRows ?? []) {
    const sid = row.student_id as string
    const list = focusByStudent.get(sid) ?? []
    list.push(row as CurrentFocusItem)
    focusByStudent.set(sid, list)
  }

  const recordsByStudent = new Map<string, RecordRow[]>()
  for (const row of recordRows ?? []) {
    const sid = row.student_id as string
    const list = recordsByStudent.get(sid) ?? []
    list.push(row as RecordRow)
    recordsByStudent.set(sid, list)
  }

  const classStartByStudent = new Map<string, string | null>()
  for (const row of historyRows ?? []) {
    classStartByStudent.set(row.student_id as string, row.start_date as string)
  }

  const computed = computeReviewItems({
    students,
    focusByStudent,
    recordsByStudent,
    classStartByStudent,
    asOfDate,
    currentTermClassIds,
  })
  const items = filterActiveReviews(computed, actions, asOfDate)
  return {
    items,
    groups: groupReviewsByStudent(items),
    summary: summarizeReviews(items),
  }
}

export async function fetchReviewQueueSummary(
  userId: string,
  asOfDate: string,
): Promise<ReturnType<typeof summarizeReviews>> {
  const payload = await fetchReviewQueue(userId, asOfDate)
  return payload.summary
}
