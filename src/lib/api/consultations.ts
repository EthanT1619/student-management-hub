import { supabase } from '../supabase'
import { todayISO } from '../constants'
import type { ConsultationNote } from '../types'
import type { StudentOverviewBundle } from '../studentSummary'
import { fetchFocusItems } from './focus'
import { countMessagesForStudent } from './messages'
import { fetchPatternSourceBundle } from './pattern'
import { fetchStudentVoice } from './psychology'
import { fetchStudent } from './students'

export async function fetchConsultationNotes(
  studentId: string,
): Promise<ConsultationNote[]> {
  const { data, error } = await supabase
    .from('consultation_notes')
    .select('*')
    .eq('student_id', studentId)
    .order('consultation_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ConsultationNote[]
}

export async function createConsultationNote(input: {
  student_id: string
  consultation_date?: string
  period_start?: string | null
  period_end?: string | null
  talking_points?: string | null
  outcome?: string | null
  created_by?: string | null
}): Promise<ConsultationNote> {
  const { data, error } = await supabase
    .from('consultation_notes')
    .insert({
      student_id: input.student_id,
      consultation_date: input.consultation_date ?? todayISO(),
      period_start: input.period_start ?? null,
      period_end: input.period_end ?? null,
      talking_points: input.talking_points?.trim() || null,
      outcome: input.outcome?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ConsultationNote
}

export async function updateConsultationNote(
  id: string,
  patch: Partial<{
    consultation_date: string
    period_start: string | null
    period_end: string | null
    talking_points: string | null
    outcome: string | null
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  }
  if (patch.talking_points !== undefined) {
    body.talking_points = patch.talking_points?.trim() || null
  }
  if (patch.outcome !== undefined) {
    body.outcome = patch.outcome?.trim() || null
  }
  const { error } = await supabase.from('consultation_notes').update(body).eq('id', id)
  if (error) throw error
}

/** Bundle for Learning Profile + Consultation Summary (reuses Pattern source load). */
export async function fetchStudentOverviewBundle(
  studentId: string,
): Promise<StudentOverviewBundle> {
  const [pattern, focusItems, voiceEntries, consultations, messageCount, student] =
    await Promise.all([
      fetchPatternSourceBundle(studentId),
      fetchFocusItems(studentId),
      fetchStudentVoice({ studentId }),
      fetchConsultationNotes(studentId).catch(() => [] as ConsultationNote[]),
      countMessagesForStudent(studentId).catch(() => 0),
      fetchStudent(studentId),
    ])
  if (!student) throw new Error('Student not found')
  return {
    ...pattern,
    student,
    focusItems,
    voiceEntries,
    consultations,
    messageCount,
  }
}
