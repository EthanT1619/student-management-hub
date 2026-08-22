import { supabase } from '../supabase'
import type {
  ContactMethod,
  RecordRow,
  RecordType,
  StampStatus,
  WorkFollowup,
} from '../types'
import { fetchOpenFollowups } from './followups'
import { fetchOpenWorkFollowups } from './workNotes'

export async function createQuickRecord(input: {
  student_id: string
  record_date: string
  record_type: RecordType
  content: string
  is_important: boolean
  tag_ids: string[]
  contact_method?: ContactMethod | null
  stamp_amount?: number | null
  stamp_status?: StampStatus | null
  followups?: { due_date: string | null; note: string }[]
  created_by?: string | null
}): Promise<string> {
  const row: Record<string, unknown> = {
    student_id: input.student_id,
    record_date: input.record_date,
    record_type: input.record_type,
    content: input.content,
    is_important: input.is_important,
    created_by: input.created_by ?? null,
  }

  if (input.record_type === 'parent_contact') {
    row.contact_method = input.contact_method ?? null
  }
  if (input.record_type === 'stamp') {
    row.stamp_amount = input.stamp_amount
    row.stamp_status = input.stamp_status ?? 'pending'
    if (input.stamp_status === 'given') {
      row.stamp_given_at = input.record_date
    }
  }

  const { data: record, error } = await supabase
    .from('records')
    .insert(row)
    .select('id')
    .single()
  if (error) throw error

  if (input.tag_ids.length) {
    const { error: tagErr } = await supabase.from('record_tags').insert(
      input.tag_ids.map((tag_id) => ({ record_id: record.id, tag_id })),
    )
    if (tagErr) throw tagErr
  }

  const fus = (input.followups ?? []).filter((f) => f.note.trim())
  if (fus.length) {
    const { error: fuErr } = await supabase.from('followups').insert(
      fus.map((f) => ({
        record_id: record.id,
        due_date: f.due_date,
        note: f.note.trim(),
        status: 'open',
      })),
    )
    if (fuErr) throw fuErr
  }

  return record.id as string
}

export async function fetchStudentRecords(studentId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select(
      `
      *,
      record_tags(tag_id, tags(*)),
      followups(*)
    `,
    )
    .eq('student_id', studentId)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export async function fetchRecordsByDate(date: string): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select(
      `
      *,
      students(id, korean_name, english_name, accent_color),
      record_tags(tag_id, tags(*))
    `,
    )
    .eq('record_date', date)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export interface CalendarDayStudent {
  id: string
  korean_name: string
  accent_color: string | null
}

/** Unique students with records on each date in the month */
export async function fetchMonthCalendarMarks(
  year: number,
  month: number,
): Promise<Record<string, CalendarDayStudent[]>> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('records')
    .select('record_date, students(id, korean_name, accent_color)')
    .gte('record_date', start)
    .lte('record_date', end)
  if (error) throw error

  const map: Record<string, CalendarDayStudent[]> = {}
  for (const row of data ?? []) {
    const date = row.record_date as string
    const raw = row.students as
      | { id: string; korean_name: string; accent_color: string | null }
      | { id: string; korean_name: string; accent_color: string | null }[]
      | null
    const st = Array.isArray(raw) ? raw[0] : raw
    if (!st?.id) continue
    if (!map[date]) map[date] = []
    if (!map[date].some((s) => s.id === st.id)) {
      map[date].push({
        id: st.id,
        korean_name: st.korean_name,
        accent_color: st.accent_color ?? null,
      })
    }
  }
  for (const date of Object.keys(map)) {
    map[date].sort((a, b) => a.korean_name.localeCompare(b.korean_name, 'ko'))
  }
  return map
}

export type CalendarDueItem = {
  id: string
  studentId: string
  korean_name: string
  note: string
  kind: 'followup' | 'work'
}

/** Open Follow-ups / Work Follow-ups keyed by due_date within month */
export async function fetchMonthDueMarks(
  year: number,
  month: number,
): Promise<Record<string, CalendarDueItem[]>> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  const [followups, workFollowups] = await Promise.all([
    fetchOpenFollowups(),
    fetchOpenWorkFollowups().catch(() => [] as WorkFollowup[]),
  ])
  const map: Record<string, CalendarDueItem[]> = {}
  for (const f of followups) {
    if (!f.due_date || f.due_date < start || f.due_date > end) continue
    const st = f.records?.students
    if (!st?.id) continue
    if (!map[f.due_date]) map[f.due_date] = []
    map[f.due_date].push({
      id: f.id,
      studentId: st.id,
      korean_name: st.korean_name,
      note: f.note,
      kind: 'followup',
    })
  }
  for (const f of workFollowups) {
    if (!f.due_date || f.due_date < start || f.due_date > end) continue
    if (!map[f.due_date]) map[f.due_date] = []
    map[f.due_date].push({
      id: f.id,
      studentId: '',
      korean_name: 'Work',
      note: f.note,
      kind: 'work',
    })
  }
  return map
}

/** @deprecated prefer fetchMonthCalendarMarks */
export async function fetchRecordDatesInMonth(year: number, month: number): Promise<string[]> {
  const marks = await fetchMonthCalendarMarks(year, month)
  return Object.keys(marks)
}

export async function markStampGiven(recordId: string, givenAt: string): Promise<void> {
  const { error } = await supabase
    .from('records')
    .update({ stamp_status: 'given', stamp_given_at: givenAt })
    .eq('id', recordId)
    .eq('record_type', 'stamp')
  if (error) throw error
}

export async function updateRecord(
  id: string,
  patch: Partial<{
    content: string
    is_important: boolean
    record_date: string
    contact_method: ContactMethod | null
    stamp_amount: number | null
    stamp_status: StampStatus | null
    stamp_given_at: string | null
  }>,
): Promise<void> {
  const { error } = await supabase.from('records').update(patch).eq('id', id)
  if (error) throw error
}

export async function fetchPendingStamps(): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select('*, students(id, korean_name, english_name)')
    .eq('record_type', 'stamp')
    .eq('stamp_status', 'pending')
    .order('record_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export async function fetchRecentRecords(limit = 15): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select(
      `
      *,
      students(id, korean_name, english_name),
      record_tags(tag_id, tags(*))
    `,
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export async function countTodayRecords(today: string): Promise<number> {
  const { count, error } = await supabase
    .from('records')
    .select('*', { count: 'exact', head: true })
    .eq('record_date', today)
  if (error) throw error
  return count ?? 0
}

export async function fetchRecordById(id: string): Promise<RecordRow | null> {
  const { data, error } = await supabase
    .from('records')
    .select(
      `
      *,
      students(id, korean_name, english_name, accent_color),
      record_tags(tag_id, tags(*)),
      followups(*)
    `,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as RecordRow | null) ?? null
}
