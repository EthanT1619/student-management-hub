/** Pure gate used by Auth UX — not a security boundary (RLS is). */
export type HubGate =
  | 'loading'
  | 'authorized'
  | 'unauthorized'
  | 'signed_out'

export function resolveHubGate(input: {
  authLoading: boolean
  hasSession: boolean
  accessKnown: boolean
  allowed: boolean
}): HubGate {
  if (input.authLoading) return 'loading'
  if (!input.hasSession) return 'signed_out'
  if (!input.accessKnown) return 'loading'
  return input.allowed ? 'authorized' : 'unauthorized'
}
