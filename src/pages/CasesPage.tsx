import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  caseOpenFollowups,
  fetchCases,
  fetchClasses,
  fetchCurrentTerm,
} from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  ACTIVE_CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  labelOf,
} from '../lib/constants'
import type { CaseRow, ClassRow } from '../lib/types'
import { CaseDetailModal } from '../components/cases/CaseDetailModal'

export { CaseDetailModal } from '../components/cases/CaseDetailModal'
export { CaseFormModal } from '../components/cases/CaseFormModal'

export function CasesPage({
  refreshKey,
  onOpenQuickRecord,
}: {
  refreshKey: number
  onOpenQuickRecord: (opts: { studentId: string; caseId: string }) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [caseType, setCaseType] = useState('')
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '')
  const studentId = searchParams.get('studentId') ?? ''
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('caseId'),
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const term = await fetchCurrentTerm()
      const cls = await fetchClasses(term?.id)
      setClasses(
        [...cls].sort((a, b) =>
          formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
        ),
      )
      const list = await fetchCases({
        status: status || undefined,
        statuses: !status && !showClosed ? ACTIVE_CASE_STATUSES : undefined,
        priority: priority || undefined,
        caseType: caseType || undefined,
        classId: classId || undefined,
        studentId: studentId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      setCases(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [
    status,
    showClosed,
    priority,
    caseType,
    classId,
    studentId,
    dateFrom,
    dateTo,
    search,
  ])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Cases</h1>
          <p className="muted" style={{ margin: 0 }}>
            학생별 장기 관리 이슈 (Record를 묶어 추적)
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="filters row wrap">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Active (진행/관찰)</option>
              {CASE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              disabled={Boolean(status)}
            />
            Include resolved/closed
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">전체</option>
              {CASE_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
              <option value="">전체</option>
              {CASE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                const next = new URLSearchParams(searchParams)
                if (e.target.value) next.set('classId', e.target.value)
                else next.delete('classId')
                setSearchParams(next, { replace: true })
              }}
            >
              <option value="">전체</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassDisplay(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="grow">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="title / summary / goal / outcome"
            />
          </label>
        </div>
        {studentId && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Student filter active ·{' '}
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('studentId')
                setSearchParams(next, { replace: true })
              }}
            >
              Clear student filter
            </button>
          </p>
        )}
      </section>

      {loading && <p className="muted">Loading…</p>}
      {!loading && cases.length === 0 && (
        <section className="card empty-state">
          <h2>표시할 Case가 없습니다.</h2>
          <p className="muted">Student Profile에서 + Case로 생성하세요.</p>
        </section>
      )}

      <div className="message-list">
        {cases.map((c) => {
          const st = c.students
          const recCount = (c.case_records ?? []).length
          const openFu = caseOpenFollowups(c).length
          return (
            <button
              key={c.id}
              type="button"
              className="card message-card clickable-row"
              onClick={() => setSelectedId(c.id)}
            >
              <div className="row wrap gap">
                {st?.accent_color && (
                  <span className={`accent-dot accent-${st.accent_color}`} />
                )}
                <strong>
                  {st ? (
                    <Link
                      to={`/students/${st.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {st.korean_name}
                    </Link>
                  ) : (
                    '학생'
                  )}
                </strong>
                <span className="muted small">
                  {st?.classes ? formatClassDisplay(st.classes) : ''}
                </span>
              </div>
              <h2 className="message-card-title">{c.title}</h2>
              <div className="chip-row">
                <span className={`badge badge-case-${c.status}`}>
                  {labelOf(CASE_STATUSES, c.status)}
                </span>
                {c.case_type && (
                  <span className="badge">{labelOf(CASE_TYPES, c.case_type)}</span>
                )}
                <span className={`badge badge-priority-${c.priority}`}>
                  {labelOf(CASE_PRIORITIES, c.priority)}
                </span>
              </div>
              <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
                Opened {c.opened_at} · Record {recCount} · Open Follow-up {openFu}
              </p>
            </button>
          )
        })}
      </div>

      {selectedId && (
        <CaseDetailModal
          caseId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void reload()}
          onOpenQuickRecord={onOpenQuickRecord}
        />
      )}
    </div>
  )
}
