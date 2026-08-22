import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey || url.includes('YOUR_PROJECT')) {
  console.warn(
    'Supabase env missing. Copy .env.example to .env and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key')

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT') && anonKey !== 'YOUR_ANON_KEY')
}
