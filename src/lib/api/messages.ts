import { supabase } from '../supabase'
import type { MessagePurpose, MessageRow } from '../types'
import { MESSAGE_SELECT, normalizeMessage } from './_shared'
import { fetchClasses } from './classes'
import { fetchStudent } from './students'

export interface MessageListFilters {
  isTemplate: boolean
  purpose?: string
  classId?: string
  studentId?: string
  termId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export async function fetchMessages(filters: MessageListFilters): Promise<MessageRow[]> {
  let q = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('is_template', filters.isTemplate)
    .order('message_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.purpose) q = q.eq('purpose', filters.purpose)
  if (filters.dateFrom) q = q.gte('message_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('message_date', filters.dateTo)

  const { data, error } = await q
  if (error) throw error

  let rows = (data ?? []).map((r) => normalizeMessage(r as Record<string, unknown>))

  if (filters.search?.trim()) {
    const hay = filters.search.trim().toLowerCase()
    rows = rows.filter((m) => {
      const blob = `${m.title ?? ''} ${m.content} ${m.notes ?? ''}`.toLowerCase()
      return blob.includes(hay)
    })
  }

  if (filters.classId) {
    const classIdsInTerm = filters.termId
      ? new Set((await fetchClasses(filters.termId)).map((c) => c.id))
      : null
    rows = rows.filter((m) =>
      (m.message_targets ?? []).some((t) => {
        if (t.target_type === 'all') return true
        if (t.target_type !== 'class' || !t.class_id) return false
        if (t.class_id !== filters.classId) return false
        if (classIdsInTerm && !classIdsInTerm.has(t.class_id)) return false
        return true
      }),
    )
  } else if (filters.termId) {
    const termClassIds = new Set((await fetchClasses(filters.termId)).map((c) => c.id))
    rows = rows.filter((m) => {
      const targets = m.message_targets ?? []
      if (targets.length === 0) return true
      if (targets.some((t) => t.target_type === 'all')) return true
      return targets.some(
        (t) => t.target_type === 'class' && t.class_id && termClassIds.has(t.class_id),
      )
    })
  }

  if (filters.studentId) {
    rows = rows.filter((m) =>
      (m.message_targets ?? []).some(
        (t) => t.target_type === 'student' && t.student_id === filters.studentId,
      ),
    )
  }

  return rows
}

export async function fetchMessage(id: string): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeMessage(data as Record<string, unknown>) : null
}

/** Direct student targets + messages targeting student's current class_id (MVP). */
export async function fetchMessagesForStudent(studentId: string): Promise<MessageRow[]> {
  const student = await fetchStudent(studentId)
  const classId = student?.class_id ?? null

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('is_template', false)
    .order('message_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []).map((r) => normalizeMessage(r as Record<string, unknown>))
  return rows.filter((m) =>
    (m.message_targets ?? []).some((t) => {
      if (t.target_type === 'student' && t.student_id === studentId) return true
      if (classId && t.target_type === 'class' && t.class_id === classId) return true
      if (t.target_type === 'all') return true
      return false
    }),
  )
}

export async function countMessagesForStudent(studentId: string): Promise<number> {
  const list = await fetchMessagesForStudent(studentId)
  return list.length
}

export type MessageTargetInput =
  | { target_type: 'all' }
  | { target_type: 'class'; class_id: string }
  | { target_type: 'student'; student_id: string }

async function replaceMessageTargets(
  messageId: string,
  targets: MessageTargetInput[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('message_targets')
    .delete()
    .eq('message_id', messageId)
  if (delErr) throw delErr

  if (targets.length === 0) return

  const rows = targets.map((t) => {
    if (t.target_type === 'all') {
      return {
        message_id: messageId,
        target_type: 'all' as const,
        class_id: null,
        student_id: null,
      }
    }
    if (t.target_type === 'class') {
      return {
        message_id: messageId,
        target_type: 'class' as const,
        class_id: t.class_id,
        student_id: null,
      }
    }
    return {
      message_id: messageId,
      target_type: 'student' as const,
      class_id: null,
      student_id: t.student_id,
    }
  })

  const { error: insErr } = await supabase.from('message_targets').insert(rows)
  if (insErr) throw insErr
}

export async function createMessage(input: {
  message_date: string
  purpose: MessagePurpose
  title?: string | null
  content: string
  notes?: string | null
  is_template?: boolean
  created_by?: string | null
  targets: MessageTargetInput[]
}): Promise<MessageRow> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr) throw authErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      message_date: input.message_date,
      purpose: input.purpose,
      title: input.title?.trim() || null,
      content: input.content.trim(),
      notes: input.notes?.trim() || null,
      is_template: input.is_template ?? false,
      created_by: input.created_by ?? null,
      owner_id: user.id,
    })
    .select('id')
    .single()
  if (error) throw error

  await replaceMessageTargets(data.id as string, input.is_template ? [] : input.targets)
  const full = await fetchMessage(data.id as string)
  if (!full) throw new Error('Message created but could not reload')
  return full
}

export async function updateMessage(
  id: string,
  input: {
    message_date: string
    purpose: MessagePurpose
    title?: string | null
    content: string
    notes?: string | null
    is_template?: boolean
    targets: MessageTargetInput[]
  },
): Promise<MessageRow> {
  const { error } = await supabase
    .from('messages')
    .update({
      message_date: input.message_date,
      purpose: input.purpose,
      title: input.title?.trim() || null,
      content: input.content.trim(),
      notes: input.notes?.trim() || null,
      is_template: input.is_template ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error

  const targets = input.is_template ? [] : input.targets
  await replaceMessageTargets(id, targets)
  const full = await fetchMessage(id)
  if (!full) throw new Error('Message updated but could not reload')
  return full
}

export async function setMessageTemplateFlag(
  id: string,
  isTemplate: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_template: isTemplate, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  if (isTemplate) {
    await replaceMessageTargets(id, [])
  }
}
