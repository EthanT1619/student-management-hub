import { supabase } from '../supabase'
import type { Followup } from '../types'

export async function completeFollowup(id: string): Promise<void> {
  const { error } = await supabase
    .from('followups')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function addFollowup(input: {
  record_id: string
  due_date: string | null
  note: string
}): Promise<void> {
  const { error } = await supabase.from('followups').insert({
    record_id: input.record_id,
    due_date: input.due_date,
    note: input.note.trim(),
    status: 'open',
  })
  if (error) throw error
}

export async function fetchOpenFollowups(): Promise<Followup[]> {
  const { data, error } = await supabase
    .from('followups')
    .select(
      `
      *,
      records(
        id, student_id, record_date, record_type, content,
        students(id, korean_name, english_name)
      )
    `,
    )
    .eq('status', 'open')
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as Followup[]
}

export async function fetchFollowupsByStatus(status: 'open' | 'done'): Promise<Followup[]> {
  const { data, error } = await supabase
    .from('followups')
    .select(
      `
      *,
      records(
        id, student_id, record_date, record_type, content,
        students(id, korean_name, english_name)
      )
    `,
    )
    .eq('status', status)
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as Followup[]
}
