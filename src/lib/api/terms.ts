import { supabase } from '../supabase'
import type { TermRow } from '../types'
import { assertStudentHubAdminClient } from '../hubAccess'

export async function fetchTerms(): Promise<TermRow[]> {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date, is_current')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCurrentTerm(): Promise<TermRow | null> {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date, is_current')
    .eq('is_current', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTerm(input: {
  name: string
  start_date: string
  end_date?: string | null
  set_current?: boolean
}): Promise<TermRow> {
  await assertStudentHubAdminClient()
  if (input.end_date && input.end_date < input.start_date) {
    throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
  }
  const { data, error } = await supabase
    .from('terms')
    .insert({
      name: input.name.trim(),
      start_date: input.start_date,
      end_date: input.end_date || null,
      is_current: false,
    })
    .select('id, name, start_date, end_date, is_current')
    .single()
  if (error) throw error
  if (input.set_current) {
    const { data: cur, error: e2 } = await supabase.rpc('set_current_term', {
      p_term_id: data.id,
    })
    if (e2) throw e2
    return cur as TermRow
  }
  return data
}

/** Metadata-only update. Never changes term id. Uses set_current_term RPC for Current. */
export async function updateTerm(input: {
  id: string
  name: string
  start_date: string
  end_date?: string | null
  is_current: boolean
  was_current: boolean
}): Promise<TermRow> {
  await assertStudentHubAdminClient()
  if (input.end_date && input.end_date < input.start_date) {
    throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
  }
  if (input.was_current && !input.is_current) {
    throw new Error(
      'Current Term을 끄려면 다른 Term을 편집하여 「현재 학기」로 지정하세요.',
    )
  }

  const { data, error } = await supabase
    .from('terms')
    .update({
      name: input.name.trim(),
      start_date: input.start_date,
      end_date: input.end_date || null,
    })
    .eq('id', input.id)
    .select('id, name, start_date, end_date, is_current')
    .single()
  if (error) throw error

  if (input.is_current && !input.was_current) {
    const { data: cur, error: e2 } = await supabase.rpc('set_current_term', {
      p_term_id: input.id,
    })
    if (e2) throw e2
    return cur as TermRow
  }

  return data
}
