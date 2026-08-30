import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { checkStudentHubAccess, checkStudentHubAdmin } from '../lib/hubAccess'
import { resolveHubGate } from '../lib/hubGate'

export type HubAccessStatus = 'loading' | 'authorized' | 'unauthorized' | 'signed_out'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  /** Hub allowlist gate (separate from Supabase session). */
  hubAccess: HubAccessStatus
  /** Allowlist role=admin (UX only; RPC/RLS are the security boundary). */
  isAdmin: boolean
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
  refreshHubAccess: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [hubAccess, setHubAccess] = useState<HubAccessStatus>('loading')
  const [isAdmin, setIsAdmin] = useState(false)
  const configured = isSupabaseConfigured()

  const evaluateHubAccess = useCallback(async (next: Session | null) => {
    if (!next?.user) {
      setHubAccess('signed_out')
      setIsAdmin(false)
      return
    }
    setHubAccess('loading')
    try {
      const allowed = await checkStudentHubAccess()
      setHubAccess(
        resolveHubGate({
          authLoading: false,
          hasSession: true,
          accessKnown: true,
          allowed,
        }),
      )
      if (allowed) {
        try {
          setIsAdmin(await checkStudentHubAdmin())
        } catch {
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    } catch {
      setHubAccess('unauthorized')
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    if (!configured) {
      setAuthLoading(false)
      setHubAccess('signed_out')
      return
    }

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setAuthLoading(false)
      void evaluateHubAccess(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void evaluateHubAccess(next)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [configured, evaluateHubAccess])

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = new URL('login', `${window.location.origin}${import.meta.env.BASE_URL}`).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setHubAccess('signed_out')
    setIsAdmin(false)
  }, [])

  const refreshHubAccess = useCallback(async () => {
    await evaluateHubAccess(session)
  }, [evaluateHubAccess, session])

  const loading = authLoading || (Boolean(session) && hubAccess === 'loading')

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured,
      hubAccess,
      isAdmin,
      signInWithGoogle,
      signOut,
      refreshHubAccess,
    }),
    [
      session,
      loading,
      configured,
      hubAccess,
      isAdmin,
      signInWithGoogle,
      signOut,
      refreshHubAccess,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
