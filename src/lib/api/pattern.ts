import { supabase } from '../supabase'
import type { PatternSourceBundle } from '../patternTracker'
import type { AbcObservation, CaseRow, ContextTag } from '../types'
import { fetchCasesForStudent } from './cases'
import { fetchStudentRecords } from './records'
import { fetchInterventions, fetchWorkingHypotheses } from './psychology'
import { fetchStudent } from './students'
import { fetchCurrentTerm } from './terms'

/**
 * Load all source rows for Pattern Tracker in a small fixed query set.
 * Aggregations stay client-side (no pattern cache table).
 */
export async function fetchPatternSourceBundle(
  studentId: string,
): Promise<PatternSourceBundle> {
  const [
    student,
    records,
    contextRows,
    abcs,
    interventions,
    hypotheses,
    activeCases,
    currentTerm,
  ] = await Promise.all([
    fetchStudent(studentId),
    fetchStudentRecords(studentId),
    supabase
      .from('record_context_tags')
      .select(
        `
        record_id,
        context_tags(*),
        records!inner(id, student_id, record_type)
      `,
      )
      .eq('records.student_id', studentId)
      .eq('records.record_type', 'observation')
      .then(({ data, error }) => {
        if (error) throw error
        return data ?? []
      }),
    supabase
      .from('abc_observations')
      .select('*')
      .eq('student_id', studentId)
      .then(({ data, error }) => {
        if (error) throw error
        return (data ?? []) as AbcObservation[]
      }),
    fetchInterventions({ studentId }),
    fetchWorkingHypotheses({ studentId }),
    fetchCasesForStudent(studentId, true).catch(() => [] as CaseRow[]),
    fetchCurrentTerm(),
  ])

  const contextsByRecordId: Record<string, ContextTag[]> = {}
  for (const row of contextRows as {
    record_id: string
    context_tags: ContextTag | ContextTag[] | null
  }[]) {
    const raw = row.context_tags
    const tag = !raw ? null : Array.isArray(raw) ? (raw[0] ?? null) : raw
    if (!tag) continue
    const list = contextsByRecordId[row.record_id] ?? []
    if (!list.some((t) => t.id === tag.id)) list.push(tag)
    contextsByRecordId[row.record_id] = list
  }

  return {
    studentId,
    managementStatus: student?.parent_management_status ?? null,
    records,
    contextsByRecordId,
    abcs,
    interventions,
    hypotheses,
    activeCases,
    currentTerm,
  }
}
