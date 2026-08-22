import { supabase } from '../supabase'
import { todayISO } from '../constants'
import type {
  CasePriority,
  CaseRow,
  CaseStatus,
  CaseType,
  Followup,
  RecordRow,
} from '../types'
import { CASE_SELECT, normalizeCaseRow } from './_shared'

export interface CaseListFilters {
  status?: string
  statuses?: CaseStatus[]
  priority?: string
  caseType?: string
  classId?: string
  studentId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function fetchCases(filters: CaseListFilters = {}): Promise<CaseRow[]> {
  let q = supabase
    .from('cases')
    .select(CASE_SELECT)
    .order('opened_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.statuses?.length) q = q.in('status', filters.statuses)
  if (filters.priority) q = q.eq('priority', filters.priority)
  if (filters.caseType) q = q.eq('case_type', filters.caseType)
  if (filters.studentId) q = q.eq('student_id', filters.studentId)
  if (filters.dateFrom) q = q.gte('opened_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('opened_at', filters.dateTo)

  const { data, error } = await q
  if (error) throw error

  let rows = (data ?? []).map((r) => normalizeCaseRow(r as Record<string, unknown>))

  if (filters.classId) {
    rows = rows.filter((c) => c.students?.class_id === filters.classId)
  }
  if (filters.search?.trim()) {
    const hay = filters.search.trim().toLowerCase()
    rows = rows.filter((c) => {
      const blob = `${c.title} ${c.summary ?? ''} ${c.goal ?? ''} ${c.outcome ?? ''}`.toLowerCase()
      return blob.includes(hay)
    })
  }
  return rows
}

export async function fetchCase(id: string): Promise<CaseRow | null> {
  const { data, error } = await supabase
    .from('cases')
    .select(CASE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeCaseRow(data as Record<string, unknown>) : null
}

export async function fetchCasesForStudent(
  studentId: string,
  activeOnly = false,
): Promise<CaseRow[]> {
  return fetchCases({
    studentId,
    statuses: activeOnly ? (['open', 'monitoring'] as CaseStatus[]) : undefined,
  })
}

export async function countActiveCasesForStudent(studentId: string): Promise<number> {
  const list = await fetchCasesForStudent(studentId, true)
  return list.length
}

/** Map record_id → linked cases (for timeline chips) */
export async function fetchCaseLinksForStudent(
  studentId: string,
): Promise<Record<string, { id: string; title: string }[]>> {
  const cases = await fetchCasesForStudent(studentId, false)
  const map: Record<string, { id: string; title: string }[]> = {}
  for (const c of cases) {
    for (const link of c.case_records ?? []) {
      if (!map[link.record_id]) map[link.record_id] = []
      map[link.record_id].push({ id: c.id, title: c.title })
    }
  }
  return map
}

export async function createCase(input: {
  student_id: string
  title: string
  case_type?: CaseType | null
  priority?: CasePriority
  summary?: string | null
  goal?: string | null
  opened_at?: string
  created_by?: string | null
}): Promise<CaseRow> {
  const { data, error } = await supabase
    .from('cases')
    .insert({
      student_id: input.student_id,
      title: input.title.trim(),
      case_type: input.case_type ?? null,
      priority: input.priority ?? 'normal',
      summary: input.summary?.trim() || null,
      goal: input.goal?.trim() || null,
      opened_at: input.opened_at ?? undefined,
      status: 'open',
      created_by: input.created_by ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  const full = await fetchCase(data.id as string)
  if (!full) throw new Error('Case created but could not reload')
  return full
}

export async function updateCase(
  id: string,
  input: {
    title: string
    case_type?: CaseType | null
    priority?: CasePriority
    status?: CaseStatus
    summary?: string | null
    goal?: string | null
    opened_at?: string
    closed_at?: string | null
    outcome?: string | null
  },
): Promise<CaseRow> {
  const { error } = await supabase
    .from('cases')
    .update({
      title: input.title.trim(),
      case_type: input.case_type ?? null,
      priority: input.priority ?? 'normal',
      status: input.status ?? 'open',
      summary: input.summary?.trim() || null,
      goal: input.goal?.trim() || null,
      opened_at: input.opened_at,
      closed_at: input.closed_at ?? null,
      outcome: input.outcome?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  const full = await fetchCase(id)
  if (!full) throw new Error('Case updated but could not reload')
  return full
}

export async function resolveCase(
  id: string,
  outcome?: string | null,
): Promise<CaseRow> {
  return updateCaseStatus(id, 'resolved', outcome)
}

export async function closeCase(id: string, outcome?: string | null): Promise<CaseRow> {
  return updateCaseStatus(id, 'closed', outcome)
}

export async function reopenCase(id: string): Promise<CaseRow> {
  const existing = await fetchCase(id)
  if (!existing) throw new Error('Case not found')
  return updateCase(id, {
    title: existing.title,
    case_type: existing.case_type,
    priority: existing.priority,
    status: 'open',
    summary: existing.summary,
    goal: existing.goal,
    opened_at: existing.opened_at,
    closed_at: null,
    outcome: existing.outcome,
  })
}

async function updateCaseStatus(
  id: string,
  status: 'resolved' | 'closed',
  outcome?: string | null,
): Promise<CaseRow> {
  const existing = await fetchCase(id)
  if (!existing) throw new Error('Case not found')
  return updateCase(id, {
    title: existing.title,
    case_type: existing.case_type,
    priority: existing.priority,
    status,
    summary: existing.summary,
    goal: existing.goal,
    opened_at: existing.opened_at,
    closed_at: todayISO(),
    outcome: outcome !== undefined ? outcome : existing.outcome,
  })
}

export async function linkRecordToCase(caseId: string, recordId: string): Promise<void> {
  const { error } = await supabase.from('case_records').insert({
    case_id: caseId,
    record_id: recordId,
  })
  if (error) {
    if (error.code === '23505') return // already linked
    throw error
  }
}

export async function unlinkRecordFromCase(caseId: string, recordId: string): Promise<void> {
  const { error } = await supabase
    .from('case_records')
    .delete()
    .eq('case_id', caseId)
    .eq('record_id', recordId)
  if (error) throw error
}

export function caseLinkedRecords(caseRow: CaseRow): RecordRow[] {
  return (caseRow.case_records ?? [])
    .map((x) => x.records)
    .filter((r): r is RecordRow => Boolean(r))
    .sort((a, b) => {
      if (a.record_date !== b.record_date) return a.record_date.localeCompare(b.record_date)
      return a.created_at.localeCompare(b.created_at)
    })
}

export function caseOpenFollowups(caseRow: CaseRow): { record: RecordRow; followup: Followup }[] {
  const out: { record: RecordRow; followup: Followup }[] = []
  for (const rec of caseLinkedRecords(caseRow)) {
    for (const f of rec.followups ?? []) {
      if (f.status === 'open') out.push({ record: rec, followup: f })
    }
  }
  out.sort((a, b) => (a.followup.due_date ?? '').localeCompare(b.followup.due_date ?? ''))
  return out
}
