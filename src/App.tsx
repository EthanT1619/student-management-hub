import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { QuickRecordModal } from './components/QuickRecordModal'
import { LoginPage } from './pages/LoginPage'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { DashboardPage } from './pages/DashboardPage'
import { StudentsPage } from './pages/StudentsPage'
import { StudentProfilePage } from './pages/StudentProfilePage'
import { CalendarPage } from './pages/CalendarPage'
import { FollowupsPage } from './pages/FollowupsPage'
import { ClassesPage } from './pages/ClassesPage'
import { ClassDetailPage } from './pages/ClassDetailPage'
import { BeforeClassPage } from './pages/BeforeClassPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { MessagesPage } from './pages/MessagesPage'
import { WorkNotesPage } from './pages/WorkNotesPage'
import { CasesPage } from './pages/CasesPage'
import { LearningProfilePage } from './pages/LearningProfilePage'

export default function App() {
  const { user, loading, hubAccess } = useAuth()
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickStudentId, setQuickStudentId] = useState<string | undefined>()
  const [lockStudent, setLockStudent] = useState(false)
  const [linkCaseId, setLinkCaseId] = useState<string | undefined>()
  const [refreshKey, setRefreshKey] = useState(0)

  function openQuickRecord(opts?: {
    studentId?: string
    lockStudent?: boolean
    caseId?: string
  }) {
    setQuickStudentId(opts?.studentId)
    setLockStudent(Boolean(opts?.lockStudent && opts.studentId))
    setLinkCaseId(opts?.caseId)
    setQuickOpen(true)
  }

  function closeQuickRecord() {
    setQuickOpen(false)
    setQuickStudentId(undefined)
    setLockStudent(false)
    setLinkCaseId(undefined)
  }

  if (loading) return <p className="muted center-pad">Loading…</p>

  if (user && hubAccess === 'unauthorized') {
    return <AccessDeniedPage />
  }

  const authorized = Boolean(user) && hubAccess === 'authorized'

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={authorized ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          element={
            authorized ? (
              <Layout onOpenQuickRecord={() => openQuickRecord()} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                refreshKey={refreshKey}
                onOpenQuickRecord={(studentId) =>
                  openQuickRecord({ studentId, lockStudent: true })
                }
              />
            }
          />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/:id" element={<ClassDetailPage />} />
          <Route
            path="/before-class"
            element={
              <BeforeClassPage
                refreshKey={refreshKey}
                onOpenQuickRecord={(studentId) =>
                  openQuickRecord({ studentId, lockStudent: true })
                }
              />
            }
          />
          <Route
            path="/review"
            element={
              <ReviewQueuePage
                refreshKey={refreshKey}
                onOpenQuickRecord={(studentId) =>
                  openQuickRecord({ studentId, lockStudent: true })
                }
              />
            }
          />
          <Route path="/messages" element={<MessagesPage refreshKey={refreshKey} />} />
          <Route path="/work-notes" element={<WorkNotesPage refreshKey={refreshKey} />} />
          <Route
            path="/cases"
            element={
              <CasesPage
                refreshKey={refreshKey}
                onOpenQuickRecord={({ studentId, caseId }) =>
                  openQuickRecord({ studentId, lockStudent: true, caseId })
                }
              />
            }
          />
          <Route
            path="/students/:id"
            element={
              <StudentProfilePage
                refreshKey={refreshKey}
                onDataChanged={() => setRefreshKey((k) => k + 1)}
                onOpenQuickRecord={(studentId, caseId) =>
                  openQuickRecord({
                    studentId,
                    lockStudent: true,
                    caseId,
                  })
                }
              />
            }
          />
          <Route
            path="/students/:id/learning-profile"
            element={
              <LearningProfilePage
                refreshKey={refreshKey}
                onDataChanged={() => setRefreshKey((k) => k + 1)}
                onOpenQuickRecord={(studentId, caseId) =>
                  openQuickRecord({
                    studentId,
                    lockStudent: true,
                    caseId,
                  })
                }
              />
            }
          />
          <Route path="/calendar" element={<CalendarPage refreshKey={refreshKey} />} />
          <Route path="/follow-ups" element={<FollowupsPage refreshKey={refreshKey} />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={authorized ? '/dashboard' : '/login'} replace />}
        />
      </Routes>

      {authorized && (
        <QuickRecordModal
          open={quickOpen}
          defaultStudentId={quickStudentId}
          lockStudent={lockStudent}
          linkCaseId={linkCaseId}
          onClose={closeQuickRecord}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  )
}
