import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LayoutProps {
  onOpenQuickRecord: () => void
}

export function Layout({ onOpenQuickRecord }: LayoutProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Student Hub</div>
        <nav className="nav">
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          <NavGroup label="Students" matchPaths={['/students', '/classes']}>
            <NavLink to="/students" end className={navClass}>
              Students
            </NavLink>
            <NavLink to="/classes" className={navClass}>
              Classes
            </NavLink>
          </NavGroup>
          <NavGroup label="Actions" matchPaths={['/follow-ups', '/review', '/calendar']}>
            <NavLink to="/follow-ups" className={navClass}>
              Follow-ups
            </NavLink>
            <NavLink to="/review" className={navClass}>
              Review Queue
            </NavLink>
            <NavLink to="/calendar" className={navClass}>
              Calendar
            </NavLink>
          </NavGroup>
          <NavGroup label="Library" matchPaths={['/cases', '/messages', '/work-notes']}>
            <NavLink to="/cases" className={navClass}>
              Cases
            </NavLink>
            <NavLink to="/messages" className={navClass}>
              Messages
            </NavLink>
            <NavLink to="/work-notes" className={navClass}>
              Work Notes
            </NavLink>
          </NavGroup>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn primary" onClick={onOpenQuickRecord}>
            + Quick Record
          </button>
          <span className="muted small">{user?.email}</span>
          <button type="button" className="btn ghost" onClick={() => void signOut()}>
            Logout
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'active' : undefined
}

function NavGroup({
  label,
  matchPaths,
  children,
}: {
  label: string
  matchPaths: string[]
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const groupActive = matchPaths.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  )

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className={`nav-group ${groupActive ? 'group-active' : ''}`} ref={ref}>
      <button
        type="button"
        className="nav-group-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label} ▾
      </button>
      {open && (
        <div className="nav-dropdown" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
