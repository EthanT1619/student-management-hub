import { supabase } from '../supabase'
import type { CurrentFocusItem } from '../types'

export async function fetchFocusItems(studentId: string): Promise<CurrentFocusItem[]> {
  const { data, error } = await supabase
    .from('current_focus_items')
    .select('*')
    .eq('student_id', studentId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createFocusItem(input: {
  student_id: string
  title: string
  note?: string | null
  tag_id?: string | null
  sort_order?: number
}): Promise<CurrentFocusItem> {
  const { data, error } = await supabase
    .from('current_focus_items')
    .insert({
      student_id: input.student_id,
      title: input.title,
      note: input.note ?? null,
      tag_id: input.tag_id ?? null,
      sort_order: input.sort_order ?? 0,
      status: 'open',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Pin a Record as Current Focus (no schema change — note stores snippet). */
export async function pinRecordAsFocus(input: {
  student_id: string
  record_date: string
  record_type: string
  content: string
  typeLabel?: string
}): Promise<CurrentFocusItem> {
  const typeLabel = input.typeLabel ?? input.record_type
  const title = `${typeLabel} · ${input.record_date}`
  const note = input.content.trim().slice(0, 240)
  return createFocusItem({
    student_id: input.student_id,
    title,
    note: note || null,
  })
}

export async function completeFocusItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('current_focus_items')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
