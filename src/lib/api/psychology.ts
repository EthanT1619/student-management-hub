import { supabase } from '../supabase'
import { daysBeforeISO, todayISO } from '../constants'
import type {
  AbcObservation,
  ContextTag,
  DetailedTrackingSummary,
  HypothesisConfidence,
  HypothesisStatus,
  Intervention,
  InterventionResponse,
  InterventionType,
  ResponseType,
  StudentVoiceEntry,
  WorkingHypothesis,
} from '../types'
import { HYPOTHESIS_SELECT, INTERVENTION_SELECT } from './_shared'

// ---------------------------------------------------------------------------
// Psychology-informed tracking
// ---------------------------------------------------------------------------

export async function createStudentVoice(input: {
  student_id: string
  content: string
  recorded_at?: string
  record_id?: string | null
  case_id?: string | null
  created_by?: string | null
}): Promise<StudentVoiceEntry> {
  const { data, error } = await supabase
    .from('student_voice_entries')
    .insert({
      student_id: input.student_id,
      content: input.content.trim(),
      recorded_at: input.recorded_at ?? todayISO(),
      record_id: input.record_id ?? null,
      case_id: input.case_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as StudentVoiceEntry
}

export async function fetchStudentVoice(filters: {
  studentId?: string
  caseId?: string
  recordId?: string
}): Promise<StudentVoiceEntry[]> {
  let q = supabase
    .from('student_voice_entries')
    .select('*')
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.studentId) q = q.eq('student_id', filters.studentId)
  if (filters.caseId) q = q.eq('case_id', filters.caseId)
  if (filters.recordId) q = q.eq('record_id', filters.recordId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as StudentVoiceEntry[]
}

export async function createWorkingHypothesis(input: {
  student_id: string
  hypothesis: string
  confidence?: HypothesisConfidence
  needs_more_observation?: boolean
  case_id?: string | null
  record_ids?: string[]
  created_by?: string | null
}): Promise<WorkingHypothesis> {
  const { data, error } = await supabase
    .from('working_hypotheses')
    .insert({
      student_id: input.student_id,
      hypothesis: input.hypothesis.trim(),
      confidence: input.confidence ?? 'low',
      needs_more_observation: input.needs_more_observation ?? true,
      case_id: input.case_id ?? null,
      status: 'active',
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  const id = data.id as string
  if (input.record_ids?.length) {
    await linkRecordsToHypothesis(id, input.record_ids)
  }
  const full = await fetchWorkingHypothesis(id)
  if (!full) throw new Error('Hypothesis created but could not reload')
  return full
}

export async function fetchWorkingHypothesis(id: string): Promise<WorkingHypothesis | null> {
  const { data, error } = await supabase
    .from('working_hypotheses')
    .select(HYPOTHESIS_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as WorkingHypothesis | null
}

export async function fetchWorkingHypotheses(filters: {
  studentId?: string
  caseId?: string
  status?: HypothesisStatus
}): Promise<WorkingHypothesis[]> {
  let q = supabase
    .from('working_hypotheses')
    .select(HYPOTHESIS_SELECT)
    .order('updated_at', { ascending: false })
  if (filters.studentId) q = q.eq('student_id', filters.studentId)
  if (filters.caseId) q = q.eq('case_id', filters.caseId)
  if (filters.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as WorkingHypothesis[]
}

export async function updateWorkingHypothesis(
  id: string,
  patch: Partial<{
    hypothesis: string
    confidence: HypothesisConfidence
    status: HypothesisStatus
    needs_more_observation: boolean
    status_note: string | null
    case_id: string | null
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  }
  if (patch.hypothesis !== undefined) body.hypothesis = patch.hypothesis.trim()
  if (
    patch.status === 'supported' ||
    patch.status === 'unsupported' ||
    patch.status === 'closed'
  ) {
    body.resolved_at = new Date().toISOString()
  }
  if (patch.status === 'active') {
    body.resolved_at = null
  }
  const { error } = await supabase.from('working_hypotheses').update(body).eq('id', id)
  if (error) throw error
}

export async function linkRecordsToHypothesis(
  hypothesisId: string,
  recordIds: string[],
): Promise<void> {
  if (!recordIds.length) return
  const { error } = await supabase.from('hypothesis_records').upsert(
    recordIds.map((record_id) => ({
      hypothesis_id: hypothesisId,
      record_id,
    })),
    { onConflict: 'hypothesis_id,record_id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function createIntervention(input: {
  student_id: string
  intervention_type: InterventionType
  description: string
  target?: string | null
  applied_at?: string
  record_id?: string | null
  case_id?: string | null
  created_by?: string | null
  hypothesis_ids?: string[]
}): Promise<Intervention> {
  const { data, error } = await supabase
    .from('interventions')
    .insert({
      student_id: input.student_id,
      intervention_type: input.intervention_type,
      description: input.description.trim(),
      target: input.target?.trim() || null,
      applied_at: input.applied_at ?? todayISO(),
      record_id: input.record_id ?? null,
      case_id: input.case_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  const created = data as Intervention
  if (input.hypothesis_ids?.length) {
    for (const hid of input.hypothesis_ids) {
      await linkInterventionsToHypothesis(hid, [created.id])
    }
  }
  const full = await fetchIntervention(created.id)
  return full ?? created
}

export async function fetchIntervention(id: string): Promise<Intervention | null> {
  const { data, error } = await supabase
    .from('interventions')
    .select(INTERVENTION_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as Intervention
  return {
    ...row,
    intervention_responses: [...(row.intervention_responses ?? [])].sort((a, b) =>
      a.response_date.localeCompare(b.response_date),
    ),
  }
}

export async function fetchInterventions(filters: {
  studentId?: string
  caseId?: string
  recordId?: string
}): Promise<Intervention[]> {
  let q = supabase
    .from('interventions')
    .select(INTERVENTION_SELECT)
    .order('applied_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.studentId) q = q.eq('student_id', filters.studentId)
  if (filters.caseId) q = q.eq('case_id', filters.caseId)
  if (filters.recordId) q = q.eq('record_id', filters.recordId)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as Intervention[]).map((row) => ({
    ...row,
    intervention_responses: [...(row.intervention_responses ?? [])].sort((a, b) =>
      a.response_date.localeCompare(b.response_date),
    ),
  }))
}

export async function linkInterventionsToHypothesis(
  hypothesisId: string,
  interventionIds: string[],
): Promise<void> {
  if (!interventionIds.length) return
  const { error } = await supabase.from('hypothesis_interventions').upsert(
    interventionIds.map((intervention_id) => ({
      hypothesis_id: hypothesisId,
      intervention_id,
    })),
    { onConflict: 'hypothesis_id,intervention_id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function unlinkInterventionFromHypothesis(
  hypothesisId: string,
  interventionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('hypothesis_interventions')
    .delete()
    .eq('hypothesis_id', hypothesisId)
    .eq('intervention_id', interventionId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// ABC + Context Tags
// ---------------------------------------------------------------------------

export async function fetchContextTags(activeOnly = true): Promise<ContextTag[]> {
  let q = supabase.from('context_tags').select('*').order('sort_order')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ContextTag[]
}

export async function fetchRecordContextTags(recordId: string): Promise<ContextTag[]> {
  const { data, error } = await supabase
    .from('record_context_tags')
    .select('context_tag_id, context_tags(*)')
    .eq('record_id', recordId)
  if (error) throw error
  const rows = (data ?? []) as unknown as {
    context_tags: ContextTag | ContextTag[] | null
  }[]
  return rows
    .map((row) => {
      const t = row.context_tags
      if (!t) return null
      return Array.isArray(t) ? (t[0] ?? null) : t
    })
    .filter((t): t is ContextTag => Boolean(t))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function setRecordContextTags(
  recordId: string,
  contextTagIds: string[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('record_context_tags')
    .delete()
    .eq('record_id', recordId)
  if (delError) throw delError
  if (!contextTagIds.length) return
  const { error } = await supabase.from('record_context_tags').insert(
    contextTagIds.map((context_tag_id) => ({
      record_id: recordId,
      context_tag_id,
    })),
  )
  if (error) throw error
}

export async function fetchAbcByRecordId(
  recordId: string,
): Promise<AbcObservation | null> {
  const { data, error } = await supabase
    .from('abc_observations')
    .select('*')
    .eq('record_id', recordId)
    .maybeSingle()
  if (error) throw error
  return data as AbcObservation | null
}

export async function upsertAbcObservation(input: {
  record_id: string
  student_id: string
  case_id?: string | null
  antecedent?: string | null
  behavior: string
  consequence?: string | null
  teacher_response?: string | null
  student_response?: string | null
  created_by?: string | null
  context_tag_ids?: string[]
}): Promise<AbcObservation> {
  const fields = {
    case_id: input.case_id ?? null,
    antecedent: input.antecedent?.trim() || null,
    behavior: input.behavior.trim(),
    consequence: input.consequence?.trim() || null,
    teacher_response: input.teacher_response?.trim() || null,
    student_response: input.student_response?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const existing = await fetchAbcByRecordId(input.record_id)
  let data: AbcObservation
  if (existing) {
    const { data: updated, error } = await supabase
      .from('abc_observations')
      .update(fields)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    data = updated as AbcObservation
  } else {
    const { data: created, error } = await supabase
      .from('abc_observations')
      .insert({
        record_id: input.record_id,
        student_id: input.student_id,
        created_by: input.created_by ?? null,
        ...fields,
      })
      .select('*')
      .single()
    if (error) throw error
    data = created as AbcObservation
  }
  if (input.context_tag_ids !== undefined) {
    await setRecordContextTags(input.record_id, input.context_tag_ids)
  }
  return data
}

/** Which of the given record ids have an ABC observation */
export async function fetchAbcRecordIdSet(recordIds: string[]): Promise<Set<string>> {
  if (!recordIds.length) return new Set()
  const { data, error } = await supabase
    .from('abc_observations')
    .select('record_id')
    .in('record_id', recordIds)
  if (error) throw error
  return new Set(((data ?? []) as { record_id: string }[]).map((r) => r.record_id))
}

export async function createInterventionResponse(input: {
  intervention_id: string
  response: string
  response_date?: string
  response_type?: ResponseType | null
}): Promise<InterventionResponse> {
  const { data, error } = await supabase
    .from('intervention_responses')
    .insert({
      intervention_id: input.intervention_id,
      response: input.response.trim(),
      response_date: input.response_date ?? todayISO(),
      response_type: input.response_type ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as InterventionResponse
}

export async function fetchDetailedTrackingSummary(
  studentId: string,
): Promise<DetailedTrackingSummary> {
  const [hypotheses, voice, interventions] = await Promise.all([
    fetchWorkingHypotheses({ studentId, status: 'active' }),
    fetchStudentVoice({ studentId }),
    fetchInterventions({ studentId }),
  ])
  const recentCutoff = daysBeforeISO(todayISO(), 13)
  return {
    activeHypotheses: hypotheses.length,
    recentVoice: voice.filter((v) => v.recorded_at >= recentCutoff).length,
    activeInterventions: interventions.filter((i) => {
      const responses = i.intervention_responses ?? []
      return responses.length === 0 || i.applied_at >= recentCutoff
    }).length,
  }
}
