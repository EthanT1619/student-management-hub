import { supabase } from '../supabase'
import type { WorkFollowup, WorkNoteRow, WorkNoteStatus, WorkNoteType } from '../types'
import { WORK_NOTE_SELECT, normalizeWorkNote } from './_shared'

export interface WorkNoteListFilters {
  noteType?: string
  status?: string
  importantOnly?: boolean
  classId?: string
  studentId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function fetchWorkNotes(filters: WorkNoteListFilters = {}): Promise<WorkNoteRow[]> {
  let q = supabase
    .from('work_notes')
    .select(WORK_NOTE_SELECT)
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.noteType) q = q.eq('note_type', filters.noteType)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.importantOnly) q = q.eq('is_important', true)
  if (filters.dateFrom) q = q.gte('note_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('note_date', filters.dateTo)

  const { data, error } = await q
  if (error) throw error

  let rows = (data ?? []).map((r) => normalizeWorkNote(r as Record<string, unknown>))

  if (filters.search?.trim()) {
    const hay = filters.search.trim().toLowerCase()
    rows = rows.filter((n) => {
      const blob = `${n.title ?? ''} ${n.content} ${n.source ?? ''}`.toLowerCase()
      return blob.includes(hay)
    })
  }
  if (filters.classId) {
    rows = rows.filter((n) =>
      (n.work_note_classes ?? []).some((c) => c.class_id === filters.classId),
    )
  }
  if (filters.studentId) {
    rows = rows.filter((n) =>
      (n.work_note_students ?? []).some((s) => s.student_id === filters.studentId),
    )
  }
  return rows
}

export async function fetchWorkNote(id: string): Promise<WorkNoteRow | null> {
  const { data, error } = await supabase
    .from('work_notes')
    .select(WORK_NOTE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeWorkNote(data as Record<string, unknown>) : null
}

export async function countWorkNotesForStudent(studentId: string): Promise<number> {
  const list = await fetchWorkNotes({ studentId })
  return list.length
}

async function replaceWorkNoteLinks(
  noteId: string,
  studentIds: string[],
  classIds: string[],
): Promise<void> {
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('work_note_students').delete().eq('work_note_id', noteId),
    supabase.from('work_note_classes').delete().eq('work_note_id', noteId),
  ])
  if (e1) throw e1
  if (e2) throw e2

  if (studentIds.length) {
    const { error } = await supabase.from('work_note_students').insert(
      studentIds.map((student_id) => ({ work_note_id: noteId, student_id })),
    )
    if (error) throw error
  }
  if (classIds.length) {
    const { error } = await supabase.from('work_note_classes').insert(
      classIds.map((class_id) => ({ work_note_id: noteId, class_id })),
    )
    if (error) throw error
  }
}

export async function createWorkNote(input: {
  note_date: string
  note_type: WorkNoteType
  source?: string | null
  title?: string | null
  content: string
  is_important?: boolean
  status?: WorkNoteStatus
  created_by?: string | null
  studentIds?: string[]
  classIds?: string[]
  followups?: { due_date: string | null; note: string }[]
}): Promise<WorkNoteRow> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr) throw authErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('work_notes')
    .insert({
      note_date: input.note_date,
      note_type: input.note_type,
      source: input.source?.trim() || null,
      title: input.title?.trim() || null,
      content: input.content.trim(),
      is_important: input.is_important ?? false,
      status: input.status ?? 'open',
      created_by: input.created_by ?? null,
      owner_id: user.id,
    })
    .select('id')
    .single()
  if (error) throw error

  const id = data.id as string
  await replaceWorkNoteLinks(id, input.studentIds ?? [], input.classIds ?? [])

  const fus = (input.followups ?? []).filter((f) => f.note.trim())
  if (fus.length) {
    const { error: fuErr } = await supabase.from('work_followups').insert(
      fus.map((f) => ({
        work_note_id: id,
        due_date: f.due_date,
        note: f.note.trim(),
        status: 'open',
      })),
    )
    if (fuErr) throw fuErr
  }

  const full = await fetchWorkNote(id)
  if (!full) throw new Error('Work note created but could not reload')
  return full
}

export async function updateWorkNote(
  id: string,
  input: {
    note_date: string
    note_type: WorkNoteType
    source?: string | null
    title?: string | null
    content: string
    is_important?: boolean
    status?: WorkNoteStatus
    studentIds?: string[]
    classIds?: string[]
  },
): Promise<WorkNoteRow> {
  const { error } = await supabase
    .from('work_notes')
    .update({
      note_date: input.note_date,
      note_type: input.note_type,
      source: input.source?.trim() || null,
      title: input.title?.trim() || null,
      content: input.content.trim(),
      is_important: input.is_important ?? false,
      status: input.status ?? 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  await replaceWorkNoteLinks(id, input.studentIds ?? [], input.classIds ?? [])
  const full = await fetchWorkNote(id)
  if (!full) throw new Error('Work note updated but could not reload')
  return full
}

export async function toggleWorkNoteImportant(id: string, important: boolean): Promise<void> {
  const { error } = await supabase
    .from('work_notes')
    .update({ is_important: important, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setWorkNoteStatus(id: string, status: WorkNoteStatus): Promise<void> {
  const { error } = await supabase
    .from('work_notes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function addWorkFollowup(input: {
  work_note_id: string
  due_date: string | null
  note: string
}): Promise<void> {
  const { error } = await supabase.from('work_followups').insert({
    work_note_id: input.work_note_id,
    due_date: input.due_date,
    note: input.note.trim(),
    status: 'open',
  })
  if (error) throw error
}

export async function completeWorkFollowup(id: string): Promise<void> {
  const { error } = await supabase
    .from('work_followups')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function fetchOpenWorkFollowups(): Promise<WorkFollowup[]> {
  const { data, error } = await supabase
    .from('work_followups')
    .select(
      `
      *,
      work_notes(id, title, content, note_type, source)
    `,
    )
    .eq('status', 'open')
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as WorkFollowup[]
}
