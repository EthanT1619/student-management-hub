import { supabase } from './supabase'

/** Calls DB SECURITY DEFINER helper; returns true/false only (no allowlist dump). */
export async function checkStudentHubAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_student_hub_user')
  if (error) throw error
  return Boolean(data)
}
