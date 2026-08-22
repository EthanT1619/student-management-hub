import { supabase } from '../supabase'
import { formatClassDisplay } from '../classFormat'
import type { ClassRow, DaysCode, LevelRow, Student } from '../types'
import { CLASS_SELECT, normalizeClassRow } from './_shared'
import { fetchStudentsByClass } from './students'

export async function fetchClassLinkage(classId: string): Promise<{
  studentCount: number
  historyCount: number
  hasLinkedHistory: boolean
}> {
  const [studentsRes, historyRes] = await Promise.all([
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId),
    supabase
      .from('student_class_history')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId),
  ])
  if (studentsRes.error) throw studentsRes.error
  if (historyRes.error) throw historyRes.error
  const studentCount = studentsRes.count ?? 0
  const historyCount = historyRes.count ?? 0
  return {
    studentCount,
    historyCount,
    hasLinkedHistory: studentCount > 0 || historyCount > 0,
  }
}

export async function fetchLevels(): Promise<LevelRow[]> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, name, sort_order')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchClasses(termId?: string | null): Promise<ClassRow[]> {
  let q = supabase.from('classes').select(CLASS_SELECT).eq('is_active', true).order('sort_order')
  if (termId) q = q.eq('term_id', termId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row) => normalizeClassRow(row as Record<string, unknown>))
}

export async function fetchClass(id: string): Promise<ClassRow | null> {
  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeClassRow(data as Record<string, unknown>) : null
}

export async function createClass(input: {
  level_name: string
  days_code: DaysCode | string
  period: string
  term_id?: string | null
}): Promise<ClassRow> {
  const { data, error } = await supabase.rpc('create_class', {
    p_level_name: input.level_name.trim(),
    p_days_code: input.days_code,
    p_period: input.period.trim(),
    p_term_id: input.term_id ?? null,
  })
  if (error) throw error
  const created = data as { id: string }
  const full = await fetchClass(created.id)
  if (!full) throw new Error('Class created but could not reload')
  return full
}

export async function updateClass(input: {
  class_id: string
  level_name?: string | null
  days_code?: string | null
  period?: string | null
  is_active?: boolean | null
}): Promise<ClassRow> {
  const { data, error } = await supabase.rpc('update_class', {
    p_class_id: input.class_id,
    p_level_name: input.level_name ?? null,
    p_days_code: input.days_code ?? null,
    p_period: input.period ?? null,
    p_is_active: input.is_active ?? null,
  })
  if (error) throw error
  const updated = data as { id: string }
  const full = await fetchClass(updated.id)
  if (!full) throw new Error('Class updated but could not reload')
  return full
}

export interface ClassStudentSummary {
  student: Student
  focusTitles: string[]
  openFollowupCount: number
  pendingStampCount: number
}

export async function fetchClassStudentSummaries(
  classId: string,
): Promise<ClassStudentSummary[]> {
  const students = await fetchStudentsByClass(classId)
  if (students.length === 0) return []

  const ids = students.map((s) => s.id)

  const [{ data: focus, error: fErr }, { data: records, error: rErr }] = await Promise.all([
    supabase
      .from('current_focus_items')
      .select('student_id, title, status')
      .in('student_id', ids)
      .eq('status', 'open'),
    supabase
      .from('records')
      .select('id, student_id, record_type, stamp_status, followups(id, status)')
      .in('student_id', ids),
  ])
  if (fErr) throw fErr
  if (rErr) throw rErr

  return students.map((student) => {
    const focusTitles = (focus ?? [])
      .filter((f) => f.student_id === student.id)
      .map((f) => f.title as string)
    const studRecords = (records ?? []).filter((r) => r.student_id === student.id)
    const openFollowupCount = studRecords.reduce((acc, r) => {
      const fus = (r.followups as { status: string }[] | null) ?? []
      return acc + fus.filter((f) => f.status === 'open').length
    }, 0)
    const pendingStampCount = studRecords.filter(
      (r) => r.record_type === 'stamp' && r.stamp_status === 'pending',
    ).length
    return { student, focusTitles, openFollowupCount, pendingStampCount }
  })
}

export async function fetchClassListStats(termId?: string | null): Promise<
  {
    classRow: ClassRow
    studentCount: number
    openFollowupCount: number
    pendingStampCount: number
  }[]
> {
  const classes = await fetchClasses(termId)
  const results = []
  for (const classRow of classes) {
    const summaries = await fetchClassStudentSummaries(classRow.id)
    results.push({
      classRow,
      studentCount: summaries.length,
      openFollowupCount: summaries.reduce((a, s) => a + s.openFollowupCount, 0),
      pendingStampCount: summaries.reduce((a, s) => a + s.pendingStampCount, 0),
    })
  }
  return results.sort((a, b) =>
    formatClassDisplay(a.classRow).localeCompare(formatClassDisplay(b.classRow), 'ko'),
  )
}
