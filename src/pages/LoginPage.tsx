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
        <p className="muted">교사 전용 학생관리 · Google 계정 + 허용 목록</p>
        {!configured && (
          <p className="error">
            `.env`에 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`를 설정하세요. (
            <code>.env.example</code> 참고)
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="btn primary"
          disabled={busy || !isSupabaseConfigured()}
          onClick={() => void onGoogle()}
        >
          {busy ? '연결 중…' : 'Google로 로그인'}
        </button>
        <p className="muted small">
          Google 로그인에 성공해도, 관리자가 등록한 허용 이메일이 아니면 Hub 데이터에 접근할 수
          없습니다.
        </p>
      </div>
    </div>
  )
}
