import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  completeFollowup,
  completeWorkFollowup,
  countTodayRecords,
  fetchOpenFollowups,
  fetchOpenWorkFollowups,
  fetchPendingStamps,
  fetchRecentRecords,
  fetchReviewQueueSummary,
  fetchStudents,
  markStampGiven,
} from '../lib/api'
import {
  ATTENTION_PARENT_STATUSES,
  PARENT_STATUSES,
  RECORD_TYPES,
  WORK_NOTE_TYPES,
  labelOf,
  todayISO,
} from '../lib/constants'
import {
  FOCUS_OVERVIEW_PREVIEW_LIMIT,
  partitionFocusOverviewPreview,
} from '../lib/focusOverview'
import type { Followup, RecordRow, Student, WorkFollowup } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { workNoteDisplayTitle } from '../lib/workNoteFormat'
import type { WorkNoteRow } from '../lib/types'
import { BeforeClassPage } from './BeforeClassPage'

interface FocusOverviewItem {
  student_id: string
  title: string
  korean_name: string
}

type DashTab = 'overview' | 'before-class'

export function DashboardPage({
  refreshKey,
  onOpenQuickRecord,
}: {
  refreshKey: number
  onOpenQuickRecord?: (studentId: string) => void
}) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: DashTab =
    searchParams.get('tab') === 'before-class' ? 'before-class' : 'overview'

  const [students, setStudents] = useState<Student[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [workFollowups, setWorkFollowups] = useState<WorkFollowup[]>([])
  const [stamps, setStamps] = useState<RecordRow[]>([])
  const [recent, setRecent] = useState<RecordRow[]>([])
  const [focusOverview, setFocusOverview] = useState<FocusOverviewItem[]>([])
  const [focusExpanded, setFocusExpanded] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [reviewSummary, setReviewSummary] = useState({
    all: 0,
    stale_focus: 0,
    observation_without_followup: 0,
    parent_contact_without_followup: 0,
    student_without_recent_record: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()

  function setTab(next: DashTab) {
    const params = new URLSearchParams(searchParams)
    if (next === 'before-class') {
      params.set('tab', 'before-class')
    } else {
      params.delete('tab')
    }
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    if (tab !== 'overview') return
    void (async () => {
      try {
        const [s, f, p, r, c, wf] = await Promise.all([
          fetchStudents(),
          fetchOpenFollowups(),
          fetchPendingStamps(),
          fetchRecentRecords(),
          countTodayRecords(today),
          fetchOpenWorkFollowups().catch(() => [] as WorkFollowup[]),
        ])
        setStudents(s)
        setFollowups(f)
        setStamps(p)
        setRecent(r)
        setTodayCount(c)
        setWorkFollowups(wf)

        if (user?.id) {
          try {
            setReviewSummary(await fetchReviewQueueSummary(user.id, today))
          } catch {
            // review_actions table may not be migrated yet
            setReviewSummary({
              all: 0,
              stale_focus: 0,
              observation_without_followup: 0,
              parent_contact_without_followup: 0,
              student_without_recent_record: 0,
            })
          }
        }

        const { data: focusRows, error: focusErr } = await supabase
          .from('current_focus_items')
          .select('student_id, title, students(korean_name)')
          .eq('status', 'open')
          .order('sort_order')
          .order('created_at')
        if (focusErr) throw focusErr
        setFocusExpanded(false)
        setFocusOverview(
          (focusRows ?? []).map((row) => {
            const st = row.students as
              | { korean_name: string }
              | { korean_name: string }[]
              | null
            const name = Array.isArray(st) ? st[0]?.korean_name : st?.korean_name
            return {
              student_id: row.student_id as string,
              title: row.title as string,
              korean_name: name ?? '학생',
            }
          }),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      }
    })()
  }, [refreshKey, today, user?.id, tab])

  const todaysFollowups = useMemo(() => {
    return followups.filter((f) => {
      if (!f.due_date) return false
      return f.due_date <= today
    })
  }, [followups, today])

  const todaysWorkFollowups = useMemo(() => {
    return workFollowups.filter((f) => {
      if (!f.due_date) return false
      return f.due_date <= today
    })
  }, [workFollowups, today])

  const attention = useMemo(
    () =>
      students.filter((s) =>
        ATTENTION_PARENT_STATUSES.includes(s.parent_management_status),
      ),
    [students],
  )

  const focusPreview = useMemo(
    () =>
      partitionFocusOverviewPreview(
        focusOverview,
        focusExpanded ? Number.POSITIVE_INFINITY : FOCUS_OVERVIEW_PREVIEW_LIMIT,
      ),
    [focusOverview, focusExpanded],
  )

  const followupGapCount =
    reviewSummary.observation_without_followup +
    reviewSummary.parent_contact_without_followup

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="row wrap gap">
          <Link className="btn" to="/review">
            Review Queue 열기
          </Link>
          <Link className="btn" to="/messages">
            Messages 열기
          </Link>
          <Link className="btn" to="/work-notes">
            Work Note 열기
          </Link>
        </div>
      </div>

      <div className="tabs dash-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'overview' ? 'tab active' : 'tab'}
          aria-selected={tab === 'overview'}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'before-class' ? 'tab active' : 'tab'}
          aria-selected={tab === 'before-class'}
          onClick={() => setTab('before-class')}
        >
          Before Class
        </button>
      </div>

      {tab === 'before-class' && onOpenQuickRecord && (
        <BeforeClassPage
          refreshKey={refreshKey}
          onOpenQuickRecord={onOpenQuickRecord}
          embedded
        />
      )}

      {tab === 'overview' && (
        <>
      {error && <p className="error">{error}</p>}
      <div className="kpi-row">
        <div className="kpi">Students: {students.length}</div>
        <div className="kpi">Today&apos;s Records: {todayCount}</div>
        <div className="kpi">
          Open Follow-ups: {followups.length + workFollowups.length}
        </div>
        <div className="kpi">Pending Stamps: {stamps.length}</div>
      </div>

      <section className="card">
        <div className="page-header">
          <div>
            <h2>Review Queue</h2>
            <p className="muted" style={{ margin: 0 }}>
              확인할 항목 {reviewSummary.all}
            </p>
          </div>
          <Link className="btn small" to="/review">
            Review Queue 열기
          </Link>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          오래된 Focus {reviewSummary.stale_focus} · 후속 기록 없음 {followupGapCount} ·
          최근 기록 없음 {reviewSummary.student_without_recent_record}
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Today&apos;s / Overdue Follow-ups</h2>
          <ul className="nested-list">
            {todaysFollowups.map((f) => {
              const st = f.records?.students
              return (
                <li key={`s-${f.id}`}>
                  <span className="badge">Student</span>{' '}
                  <strong>{f.due_date && f.due_date < today ? 'OVERDUE' : 'DUE'}</strong>{' '}
                  {st ? (
                    <Link to={`/students/${st.id}`}>{st.korean_name}</Link>
                  ) : (
                    '학생'
                  )}
                  : {f.note}{' '}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      void completeFollowup(f.id).then(() =>
                        setFollowups((prev) => prev.filter((x) => x.id !== f.id)),
                      )
                    }
                  >
                    Done
                  </button>
                </li>
              )
            })}
            {todaysWorkFollowups.map((f) => {
              const wn = f.work_notes
              const title = wn
                ? workNoteDisplayTitle(wn as WorkNoteRow)
                : '업무'
              return (
                <li key={`w-${f.id}`}>
                  <span className="badge">Work</span>{' '}
                  <strong>{f.due_date && f.due_date < today ? 'OVERDUE' : 'DUE'}</strong>{' '}
                  {wn?.note_type ? (
                    <span className="muted small">
                      {labelOf(WORK_NOTE_TYPES, wn.note_type)}
                    </span>
                  ) : null}{' '}
                  <Link to="/work-notes">{title}</Link>
                  : {f.note}{' '}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      void completeWorkFollowup(f.id).then(() =>
                        setWorkFollowups((prev) => prev.filter((x) => x.id !== f.id)),
                      )
                    }
                  >
                    Done
                  </button>
                </li>
              )
            })}
            {todaysFollowups.length === 0 && todaysWorkFollowups.length === 0 && (
              <li className="muted">없음</li>
            )}
          </ul>
        </section>

        <section className="card">
          <h2>Pending Stamps</h2>
          <ul className="nested-list">
            {stamps.map((s) => (
              <li key={s.id}>
                {s.students ? (
                  <Link to={`/students/${s.students.id}`}>{s.students.korean_name}</Link>
                ) : (
                  '학생'
                )}{' '}
                +{s.stamp_amount}: {s.content}{' '}
                <button
                  type="button"
                  className="btn small"
                  onClick={() =>
                    void markStampGiven(s.id, today).then(() =>
                      setStamps((prev) => prev.filter((x) => x.id !== s.id)),
                    )
                  }
                >
                  Mark Given
                </button>
              </li>
            ))}
            {stamps.length === 0 && <li className="muted">없음</li>}
          </ul>
        </section>
      </div>

      <div className="grid-2">
        <section className="card dash-pair-card">
          <h2>Students Needing Attention</h2>
          <ul className="dash-pair-list">
            {attention.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}`}>
                  {s.accent_color && (
                    <span className={`accent-dot accent-${s.accent_color}`} />
                  )}
                  {s.korean_name}
                </Link>{' '}
                <span className={`badge badge-mgmt ${s.parent_management_status}`}>
                  {labelOf(PARENT_STATUSES, s.parent_management_status)}
                </span>
              </li>
            ))}
            {attention.length === 0 && <li className="muted">없음</li>}
          </ul>
        </section>

        <section className="card dash-pair-card">
          <div className="page-header dash-pair-header">
            <h2>Current Focus Overview</h2>
            {focusOverview.length > 0 ? (
              <span className="badge muted-count" aria-label={`open Focus ${focusOverview.length}개`}>
                {focusOverview.length}
              </span>
            ) : null}
          </div>
          <ul className="dash-pair-list">
            {focusPreview.visible.map((item, idx) => (
              <li key={`${item.student_id}-${idx}-${item.title}`}>
                <Link to={`/students/${item.student_id}`}>{item.korean_name}</Link>
                {' — '}
                {item.title}
              </li>
            ))}
            {focusOverview.length === 0 && <li className="muted">없음</li>}
          </ul>
          {!focusExpanded && focusPreview.hiddenCount > 0 && (
            <button
              type="button"
              className="btn ghost small dash-pair-more"
              onClick={() => setFocusExpanded(true)}
            >
              나머지 {focusPreview.hiddenCount}개 더 보기 (전체 {focusPreview.total}개)
            </button>
          )}
          {focusExpanded && focusOverview.length > FOCUS_OVERVIEW_PREVIEW_LIMIT && (
            <button
              type="button"
              className="btn ghost small dash-pair-more"
              onClick={() => setFocusExpanded(false)}
            >
              접기 ({FOCUS_OVERVIEW_PREVIEW_LIMIT}개만)
            </button>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Mini Calendar</h2>
        <p className="muted">
          오늘: {today}. 전체 월간 보기는 <Link to="/calendar">Calendar</Link>.
        </p>
      </section>

      <section className="card">
        <h2>Recent Activity</h2>
        <ul className="nested-list">
          {recent.map((r) => (
            <li key={r.id}>
              {r.record_date} ·{' '}
              {r.students ? (
                <Link to={`/students/${r.students.id}`}>{r.students.korean_name}</Link>
              ) : (
                '—'
              )}{' '}
              · {labelOf(RECORD_TYPES, r.record_type)} · {r.content.slice(0, 80)}
              {r.content.length > 80 ? '…' : ''}
            </li>
          ))}
        </ul>
      </section>
        </>
      )}
    </div>
  )
}
