import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signInWithGoogle, configured } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      const err = await signInWithGoogle()
      if (err) setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card stack">
        <h1>Student Hub</h1>
        <p className="muted">수업 전후 학생 기록과 후속을 한곳에서</p>
        {!configured && (
          <p className="error">지금은 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="btn primary"
          disabled={busy || !isSupabaseConfigured()}
          onClick={() => void onGoogle()}
        >
          {busy ? '로그인 중…' : 'Google로 로그인'}
        </button>
        <p className="muted small">등록된 교사 계정으로만 이용할 수 있습니다.</p>
      </div>
    </div>
  )
}
