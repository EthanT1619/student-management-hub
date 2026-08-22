import {
  ATTENTION_PARENT_STATUSES,
  IMPORTANT_RECORD_LOOKBACK_DAYS,
} from './constants'
import type {
  CurrentFocusItem,
  Followup,
  ParentManagementStatus,
  RecordRow,
  Student,
} from './types'

export interface BeforeClassStudentBundle {
  student: Student
  overdueFollowups: Followup[]
  dueTodayFollowups: Followup[]
  upcomingFollowups: Followup[]
  openFocus: CurrentFocusItem[]
  pendingStamps: RecordRow[]
  importantRecords: RecordRow[]
}

export function hasManagementAttention(status: ParentManagementStatus): boolean {
  return ATTENTION_PARENT_STATUSES.includes(status)
}

export function studentNeedsAttention(item: BeforeClassStudentBundle): boolean {
  return (
    item.overdueFollowups.length > 0 ||
    item.dueTodayFollowups.length > 0 ||
    item.pendingStamps.length > 0 ||
    item.openFocus.length > 0 ||
    hasManagementAttention(item.student.parent_management_status) ||
    item.importantRecords.length > 0
  )
}

/**
 * Sort keys (lower = higher priority):
 * 1 Overdue FU → 2 Due today → 3 장기위험생 → 4 집중 → 5 Pending stamp
 * → 6 Current Focus → 7 Important → name
 */
export function attentionSortKey(item: BeforeClassStudentBundle): (number | string)[] {
  const status = item.student.parent_management_status
  return [
    item.overdueFollowups.length > 0 ? 0 : 1,
    item.dueTodayFollowups.length > 0 ? 0 : 1,
    status === 'retention_risk' ? 0 : 1,
    status === 'intensive_care' ? 0 : 1,
    item.pendingStamps.length > 0 ? 0 : 1,
    item.openFocus.length > 0 ? 0 : 1,
    item.importantRecords.length > 0 ? 0 : 1,
    item.student.korean_name,
  ]
}

export function compareAttention(
  a: BeforeClassStudentBundle,
  b: BeforeClassStudentBundle,
): number {
  const ka = attentionSortKey(a)
  const kb = attentionSortKey(b)
  for (let i = 0; i < ka.length; i++) {
    const av = ka[i]
    const bv = kb[i]
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return 0
}

export function partitionFollowupsForDate(
  followups: Followup[],
  asOfDate: string,
): {
  overdue: Followup[]
  dueToday: Followup[]
  upcoming: Followup[]
} {
  const overdue: Followup[] = []
  const dueToday: Followup[] = []
  const upcoming: Followup[] = []
  for (const f of followups) {
    if (f.status !== 'open') continue
    if (!f.due_date) {
      upcoming.push(f)
      continue
    }
    if (f.due_date < asOfDate) overdue.push(f)
    else if (f.due_date === asOfDate) dueToday.push(f)
    else upcoming.push(f)
  }
  const byDue = (x: Followup, y: Followup) =>
    (x.due_date ?? '').localeCompare(y.due_date ?? '')
  overdue.sort(byDue)
  dueToday.sort(byDue)
  upcoming.sort(byDue)
  return { overdue, dueToday, upcoming }
}

export { IMPORTANT_RECORD_LOOKBACK_DAYS }
