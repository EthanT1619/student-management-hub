import type {
  ClassRow,
  LevelRow,
  TermRow,
  Student,
  MessageRow,
  MessageTarget,
  MessagePurpose,
  MessageTargetType,
  WorkNoteRow,
  WorkFollowup,
  WorkNoteStatus,
  WorkNoteType,
  CaseRow,
  CaseStatus,
  CasePriority,
  CaseType,
  RecordRow,
} from '../types'

export const CLASS_SELECT =
  'id, term_id, level_id, days_code, period, is_active, sort_order, levels(id, name, sort_order), terms(id, name, start_date, end_date, is_current)'

export const MESSAGE_SELECT = `
  *,
  message_targets(
    id, message_id, target_type, class_id, student_id, created_at,
    classes(${CLASS_SELECT}),
    students(id, korean_name, english_name, accent_color)
  )
`

export const WORK_NOTE_SELECT = `
  *,
  work_note_students(
    student_id,
    students(id, korean_name, english_name, accent_color)
  ),
  work_note_classes(
    class_id,
    classes(${CLASS_SELECT})
  ),
  work_followups(*)
`

export const CASE_SELECT = `
  *,
  students(*, classes(${CLASS_SELECT})),
  case_records(
    record_id,
    created_at,
    records(
      *,
      record_tags(tag_id, tags(*)),
      followups(*)
    )
  )
`

export const HYPOTHESIS_SELECT = `
  *,
  hypothesis_records(
    record_id,
    records(
      id, record_date, record_type, content,
      abc_observations(id)
    )
  ),
  hypothesis_interventions(
    intervention_id,
    interventions(id, intervention_type, description, applied_at, target)
  )
`

export const INTERVENTION_SELECT = `
  *,
  intervention_responses(*),
  hypothesis_interventions(
    hypothesis_id,
    working_hypotheses(id, hypothesis, confidence, status)
  )
`

export function normalizeTermRow(raw: unknown): TermRow | null {
  if (!raw || typeof raw !== 'object') return null
  const t = Array.isArray(raw) ? raw[0] : raw
  if (!t || typeof t !== 'object') return null
  const row = t as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    start_date: row.start_date as string,
    end_date: (row.end_date as string | null) ?? null,
    is_current: Boolean(row.is_current),
  }
}

export function normalizeClassRow(row: Record<string, unknown>): ClassRow {
  const levelsRaw = row.levels
  const levels = Array.isArray(levelsRaw)
    ? ((levelsRaw[0] as LevelRow | undefined) ?? null)
    : ((levelsRaw as LevelRow | null) ?? null)
  return {
    id: row.id as string,
    term_id: row.term_id as string,
    level_id: row.level_id as string,
    days_code: row.days_code as string,
    period: row.period as string,
    is_active: row.is_active as boolean,
    sort_order: row.sort_order as number,
    levels,
    terms: normalizeTermRow(row.terms),
  }
}

export function normalizeStudentRow(row: Record<string, unknown>): Student {
  const classesRaw = row.classes
  let classes: ClassRow | null = null
  if (classesRaw && typeof classesRaw === 'object') {
    classes = normalizeClassRow(classesRaw as Record<string, unknown>)
  }
  return {
    id: row.id as string,
    korean_name: row.korean_name as string,
    english_name: (row.english_name as string | null) ?? null,
    class_id: (row.class_id as string | null) ?? null,
    accent_color: (row.accent_color as string | null) ?? null,
    enrollment_status: row.enrollment_status as Student['enrollment_status'],
    parent_management_status:
      row.parent_management_status as Student['parent_management_status'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    classes,
  }
}

export function normalizeMessage(row: Record<string, unknown>): MessageRow {
  const targetsRaw = (row.message_targets as Record<string, unknown>[] | null) ?? []
  const message_targets: MessageTarget[] = targetsRaw.map((t) => {
    const classesRaw = t.classes
    let classes: ClassRow | null = null
    if (classesRaw && typeof classesRaw === 'object') {
      classes = normalizeClassRow(
        (Array.isArray(classesRaw) ? classesRaw[0] : classesRaw) as Record<string, unknown>,
      )
    }
    const studentsRaw = t.students
    const st = Array.isArray(studentsRaw) ? studentsRaw[0] : studentsRaw
    return {
      id: t.id as string,
      message_id: t.message_id as string,
      target_type: t.target_type as MessageTargetType,
      class_id: (t.class_id as string | null) ?? null,
      student_id: (t.student_id as string | null) ?? null,
      created_at: t.created_at as string,
      classes,
      students: st
        ? {
            id: (st as { id: string }).id,
            korean_name: (st as { korean_name: string }).korean_name,
            english_name: ((st as { english_name: string | null }).english_name) ?? null,
            accent_color: ((st as { accent_color: string | null }).accent_color) ?? null,
          }
        : null,
    }
  })
  return {
    id: row.id as string,
    message_date: row.message_date as string,
    purpose: row.purpose as MessagePurpose,
    title: (row.title as string | null) ?? null,
    content: row.content as string,
    notes: (row.notes as string | null) ?? null,
    is_template: Boolean(row.is_template),
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    message_targets,
  }
}

export function normalizeWorkNote(row: Record<string, unknown>): WorkNoteRow {
  const studentsRaw = (row.work_note_students as Record<string, unknown>[] | null) ?? []
  const classesRaw = (row.work_note_classes as Record<string, unknown>[] | null) ?? []
  const fusRaw = (row.work_followups as WorkFollowup[] | null) ?? []

  return {
    id: row.id as string,
    note_date: row.note_date as string,
    note_type: row.note_type as WorkNoteType,
    source: (row.source as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    content: row.content as string,
    is_important: Boolean(row.is_important),
    status: row.status as WorkNoteStatus,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    work_note_students: studentsRaw.map((x) => {
      const st = x.students
      const s = Array.isArray(st) ? st[0] : st
      return {
        student_id: x.student_id as string,
        students: s
          ? {
              id: (s as { id: string }).id,
              korean_name: (s as { korean_name: string }).korean_name,
              english_name: ((s as { english_name: string | null }).english_name) ?? null,
              accent_color: ((s as { accent_color: string | null }).accent_color) ?? null,
            }
          : null,
      }
    }),
    work_note_classes: classesRaw.map((x) => {
      const cRaw = x.classes
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
      return {
        class_id: x.class_id as string,
        classes: c ? normalizeClassRow(c as Record<string, unknown>) : null,
      }
    }),
    work_followups: [...fusRaw].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return (a.due_date ?? '').localeCompare(b.due_date ?? '')
    }),
  }
}

export function normalizeCaseRow(row: Record<string, unknown>): CaseRow {
  const studentRaw = row.students
  let students: Student | null = null
  if (studentRaw && typeof studentRaw === 'object') {
    const s = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
    if (s) students = normalizeStudentRow(s as Record<string, unknown>)
  }

  const links = (row.case_records as Record<string, unknown>[] | null) ?? []
  const case_records = links.map((link) => {
    const recRaw = link.records
    const rec = Array.isArray(recRaw) ? recRaw[0] : recRaw
    return {
      record_id: link.record_id as string,
      created_at: link.created_at as string,
      records: rec ? (rec as RecordRow) : null,
    }
  })

  return {
    id: row.id as string,
    student_id: row.student_id as string,
    title: row.title as string,
    case_type: (row.case_type as CaseType | null) ?? null,
    status: row.status as CaseStatus,
    priority: row.priority as CasePriority,
    summary: (row.summary as string | null) ?? null,
    goal: (row.goal as string | null) ?? null,
    opened_at: row.opened_at as string,
    closed_at: (row.closed_at as string | null) ?? null,
    outcome: (row.outcome as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    students,
    case_records,
  }
}
