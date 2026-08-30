import { supabase } from './supabase'

/** Calls DB SECURITY DEFINER helper; returns true/false only (no allowlist dump). */
export async function checkStudentHubAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_student_hub_user')
  if (error) throw error
  return Boolean(data)
}

/** UX helper — not a security boundary. RPC/RLS enforce admin. */
export async function checkStudentHubAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_student_hub_admin')
  if (error) throw error
  return Boolean(data)
}

export async function assertStudentHubAdminClient(): Promise<void> {
  const ok = await checkStudentHubAdmin()
  if (!ok) throw new Error('관리자만 수행할 수 있습니다.')
}
