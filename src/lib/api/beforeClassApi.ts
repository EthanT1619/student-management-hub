import { supabase } from '../supabase'
import {
  compareAttention,
  partitionFollowupsForDate,
  type BeforeClassStudentBundle,
} from '../beforeClass'
import { daysBeforeISO } from '../constants'
import type { CurrentFocusItem, Followup, RecordRow } from '../types'
import { fetchStudentsByClass } from './students'

/** Class-scoped Before Class data — ~3 queries, attention computed client-side. */
export async function fetchBeforeClassBundle(
  classId: string,
  asOfDate: string,
  lookbackDays: number,
): Promise<BeforeClassStudentBundle[]> {
  const students = await fetchStudentsByClass(classId)
  if (students.length === 0) return []

  const ids = students.map((s) => s.id)
  const importantFrom = daysBeforeISO(asOfDate, lookbackDays - 1)

  const [
    { data: focusRows, error: focusErr },
    { data: recordRows, error: recordErr },
  ] = await Promise.all([
    supabase
      .from('current_focus_items')
      .select('*')
      .in('student_id', ids)
      .eq('status', 'open')
      .order('sort_order'),
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
  ])
  if (focusErr) throw focusErr
  if (recordErr) throw recordErr

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

  const bundles = students.map((student) => {
    const records = recordsByStudent.get(student.id) ?? []
    const allOpenFu: Followup[] = records.flatMap((r) =>
      ((r.followups ?? []) as Followup[])
        .filter((f) => f.status === 'open')
        .map((f) => ({ ...f, records: r })),
    )
    const { overdue, dueToday, upcoming } = partitionFollowupsForDate(allOpenFu, asOfDate)
    const pendingStamps = records.filter(
      (r) => r.record_type === 'stamp' && r.stamp_status === 'pending',
    )
    const importantRecords = records
      .filter(
        (r) =>
          r.is_important &&
          r.record_date >= importantFrom &&
          r.record_date <= asOfDate,
      )
      .slice(0, 2)

    return {
      student,
      overdueFollowups: overdue,
      dueTodayFollowups: dueToday,
      upcomingFollowups: upcoming,
      openFocus: focusByStudent.get(student.id) ?? [],
      pendingStamps,
      importantRecords,
    }
  })

  return bundles.sort(compareAttention)
}
