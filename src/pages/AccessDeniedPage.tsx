import { useAuth } from '../context/AuthContext'

export function AccessDeniedPage() {
  const { user, signOut } = useAuth()
  return (
    <div className="login-page">
      <div className="login-card stack">
        <h1>접근할 수 없습니다</h1>
        <p className="error">이 계정으로는 Student Hub를 사용할 수 없습니다.</p>
        {user?.email && (
          <p className="muted small">
            현재 로그인: <code>{user.email}</code>
          </p>
        )}
        <p className="muted small">권한이 필요하면 관리자에게 문의해 주세요.</p>
        <button type="button" className="btn primary" onClick={() => void signOut()}>
          로그아웃
        </button>
      </div>
    </div>
  )
}
