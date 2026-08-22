import { useAuth } from '../context/AuthContext'

export function AccessDeniedPage() {
  const { user, signOut } = useAuth()
  return (
    <div className="login-page">
      <div className="login-card stack">
        <h1>접근 권한 없음</h1>
        <p className="error">이 계정은 Student Hub 사용 권한이 없습니다.</p>
        {user?.email && (
          <p className="muted small">
            로그인된 계정: <code>{user.email}</code>
          </p>
        )}
        <p className="muted small">
          허용 이메일은 Supabase의 <code>allowed_student_hub_users</code>에 등록되어야 합니다.
        </p>
        <button type="button" className="btn primary" onClick={() => void signOut()}>
          로그아웃
        </button>
      </div>
    </div>
  )
}
