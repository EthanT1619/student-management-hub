import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  changeParentStatus,
  countMessagesForStudent,
  countWorkNotesForStudent,
  fetchCaseLinksForStudent,
  fetchCasesForStudent,
  fetchDetailedTrackingSummary,
  fetchFocusItems,
  fetchParentHistory,
  fetchStudent,
  fetchStudentClassHistory,
  fetchStudentRecords,
  fetchTags,
} from '../lib/api'
import {
  CONTACT_METHODS,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  MANAGEMENT_STATUS_LABEL,
  PARENT_STATUSES,
  RECORD_TYPES,
  labelOf,
  ENROLLMENT_STATUSES,
} from '../lib/constants'
import { formatClassDisplay } from '../lib/classFormat'
import type {
  CaseRow,
  CurrentFocusItem,
  DetailedTrackingSummary,
  ParentManagementStatus,
  ParentStatusHistory,
  RecordRow,
  RecordType,
  Student,
  StudentClassHistoryRow,
  Tag,
} from '../lib/types'
import {
  RecordDetailModal,
  openRecordOnKeyDown,
} from '../components/RecordDetailModal'
import { StudentMessagesModal } from '../components/StudentMessagesModal'
import { DetailedTrackingPanel } from '../components/DetailedTrackingPanel'
import { StudentActionsSection } from '../components/studentProfile/StudentActionsSection'
import { StudentFocusSection } from '../components/studentProfile/StudentFocusSection'
import { CaseDetailModal } from '../components/cases/CaseDetailModal'
import { CaseFormModal } from '../components/cases/CaseFormModal'
import { PatternTrackerModal } from '../components/PatternTrackerModal'
import { ConsultationSummaryModal } from '../components/ConsultationSummaryModal'
import { useAuth } from '../context/AuthContext'

export function StudentProfilePage({
  refreshKey,
  onDataChanged,
  onOpenQuickRecord,
}: {
  refreshKey: number
  onDataChanged?: () => void
  onOpenQuickRecord?: (studentId: string, caseId?: string) => void
}) {
  const { id } = useParams()
  const { user } = useAuth()
  const [student, setStudent] = useState<Student | null>(null)
  const [focus, setFocus] = useState<CurrentFocusItem[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [history, setHistory] = useState<ParentStatusHistory[]>([])
  const [classHistory, setClassHistory] = useState<StudentClassHistoryRow[]>([])
  const [activeCases, setActiveCases] = useState<CaseRow[]>([])
  const [caseLinks, setCaseLinks] = useState<
    Record<string, { id: string; title: string }[]>
  >({})
  const [tags, setTags] = useState<Tag[]>([])
  const [typeFilter, setTypeFilter] = useState<RecordType | 'all'>('all')
  const [tagFilter, setTagFilter] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [showParentHistory, setShowParentHistory] = useState(false)
  const [showClassHistory, setShowClassHistory] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [messageCount, setMessageCount] = useState(0)
  const [workNoteCount, setWorkNoteCount] = useState(0)
  const [trackingSummary, setTrackingSummary] = useState<DetailedTrackingSummary>({
    activeHypotheses: 0,
    recentVoice: 0,
    activeInterventions: 0,
  })
  const [showDetailedTracking, setShowDetailedTracking] = useState(false)
  const [showPatterns, setShowPatterns] = useState(false)
  const [showConsultation, setShowConsultation] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const [s, f, r, h, t, ch, msgCount, wnCount, cases, links, tracking] =
      await Promise.all([
        fetchStudent(id),
        fetchFocusItems(id),
        fetchStudentRecords(id),
        fetchParentHistory(id),
        fetchTags(),
        fetchStudentClassHistory(id),
        countMessagesForStudent(id).catch(() => 0),
        countWorkNotesForStudent(id).catch(() => 0),
        fetchCasesForStudent(id, true).catch(() => [] as CaseRow[]),
        fetchCaseLinksForStudent(id).catch(() => ({})),
        fetchDetailedTrackingSummary(id).catch(() => ({
          activeHypotheses: 0,
          recentVoice: 0,
          activeInterventions: 0,
        })),
      ])
    setStudent(s)
    setFocus(f)
    setRecords(r)
    setHistory(h)
    setTags(t)
    setClassHistory(ch)
    setMessageCount(msgCount)
    setWorkNoteCount(wnCount)
    setActiveCases(cases)
    setCaseLinks(links)
    setTrackingSummary(tracking)
  }, [id])

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [load, refreshKey])

  const notifyChanged = useCallback(async () => {
    await load()
    onDataChanged?.()
  }, [load, onDataChanged])

  const openFollowups = useMemo(
    () =>
      records.flatMap((r) => (r.followups ?? []).filter((f) => f.status === 'open')).length,
    [records],
  )
  const pendingStamps = useMemo(
    () => records.filter((r) => r.record_type === 'stamp' && r.stamp_status === 'pending').length,
    [records],
  )
  const observationCount = useMemo(
    () => records.filter((r) => r.record_type === 'observation').length,
    [records],
  )

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.record_type !== typeFilter) return false
      if (importantOnly && !r.is_important) return false
      if (tagFilter) {
        const ids = (r.record_tags ?? []).map((x) => x.tag_id)
        if (!ids.includes(tagFilter)) return false
      }
      return true
    })
  }, [records, typeFilter, importantOnly, tagFilter])

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  )

  if (!student && !error) return <p className="muted">Loading…</p>
  if (!student) return <p className="error">{error}</p>

  return (
    <div className="page">
      {error && <p className="error">{error}</p>}

      <section className="card section-profile-header">
        <div className="page-header">
          <div>
            <h1>
              {student.accent_color && (
                <span className={`accent-dot accent-${student.accent_color}`} />
              )}
              {student.korean_name}
              {student.english_name ? ` / ${student.english_name}` : ''}
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              {student.classes
                ? formatClassDisplay({ ...student.classes, includeTerm: true })
                : '반 미지정'}
            </p>
          </div>
          <div className="row wrap gap">
            <button
              type="button"
              className="btn primary"
              onClick={() => onOpenQuickRecord?.(student.id)}
            >
              + Record
            </button>
            <details className="more-menu">
              <summary className="btn small">More</summary>
              <div className="more-menu-panel">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setShowConsultation(true)}
                >
                  상담 요약
                </button>
                <Link
                  className="btn ghost small"
                  to={`/students/${student.id}/learning-profile`}
                >
                  종합 프로필
                </Link>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setShowMessages(true)}
                >
                  Messages {messageCount}
                </button>
                <Link
                  className="btn ghost small"
                  to={`/work-notes?studentId=${student.id}`}
                >
                  Work Notes {workNoteCount}
                </Link>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setShowClassHistory(true)}
                >
                  반 이력
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setShowParentHistory(true)}
                >
                  관리상태 이력
                </button>
              </div>
            </details>
          </div>
        </div>
        <div className="row wrap gap" style={{ marginTop: 'var(--space-4)' }}>
          <span className="badge">
            재원: {labelOf(ENROLLMENT_STATUSES, student.enrollment_status)}
          </span>
          <span className="row wrap gap" style={{ alignItems: 'center' }}>
            <span className="muted small">{MANAGEMENT_STATUS_LABEL}</span>
            <span className={`badge badge-mgmt ${student.parent_management_status}`}>
              {labelOf(PARENT_STATUSES, student.parent_management_status)}
            </span>
          </span>
          <ParentStatusControl
            student={student}
            onChanged={async () => {
              await load()
            }}
          />
        </div>
        <div className="kpi-row" style={{ marginTop: 'var(--space-5)' }}>
          <div className="kpi">Open Follow-ups: {openFollowups}</div>
          <div className="kpi">Pending Stamps: {pendingStamps}</div>
          <div className="kpi">Active Cases: {activeCases.length}</div>
        </div>
      </section>

      <StudentFocusSection
        studentId={student.id}
        items={focus}
        tags={tags}
        onChanged={load}
      />

      <StudentActionsSection
        records={records}
        onOpenRecord={(id) => setSelectedRecordId(id)}
      />

      <section className="card section-now">
        <div className="page-header">
          <div>
            <h2>Active Cases</h2>
            <p className="muted small" style={{ margin: 0 }}>
              진행중 {activeCases.length}
            </p>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setShowCaseForm(true)}
          >
            + Case
          </button>
        </div>
        <ul className="focus-list">
          {activeCases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="btn ghost"
                style={{ textAlign: 'left', flex: 1 }}
                onClick={() => setSelectedCaseId(c.id)}
              >
                <strong>{c.title}</strong>
                <div className="chip-row" style={{ marginTop: '0.35rem' }}>
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
              </button>
            </li>
          ))}
          {activeCases.length === 0 && (
            <li className="muted">Active Case 없음</li>
          )}
        </ul>
      </section>

      <section className="card section-history">
        <div className="page-header">
          <h2>Timeline</h2>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => onOpenQuickRecord?.(student.id)}
          >
            + Record
          </button>
        </div>
        <p className="muted small">카드를 클릭하면 Record Detail에서 Follow-up을 관리할 수 있습니다.</p>
        <div className="filters row wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RecordType | 'all')}
          >
            <option value="all">All</option>
            {RECORD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="inline">
            <input
              type="checkbox"
              checked={importantOnly}
              onChange={(e) => setImportantOnly(e.target.checked)}
            />
            Important only
          </label>
        </div>
        <ul className="timeline">
          {filteredRecords.map((r) => {
            const openFu = (r.followups ?? []).filter((f) => f.status === 'open').length
            return (
              <li key={r.id}>
                <div
                  className="timeline-item clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={`${r.record_date} ${labelOf(RECORD_TYPES, r.record_type)} 상세 보기`}
                  onClick={() => setSelectedRecordId(r.id)}
                  onKeyDown={(e) =>
                    openRecordOnKeyDown(e, () => setSelectedRecordId(r.id))
                  }
                >
                  <div className="timeline-meta">
                    <strong>{r.record_date}</strong>
                    <span>{labelOf(RECORD_TYPES, r.record_type)}</span>
                    {r.is_important && <span className="star">★</span>}
                    {r.record_type === 'stamp' && (
                      <span>
                        +{r.stamp_amount} · {r.stamp_status}
                        {r.stamp_given_at ? ` (${r.stamp_given_at})` : ''}
                      </span>
                    )}
                    {r.record_type === 'parent_contact' && r.contact_method && (
                      <span>{labelOf(CONTACT_METHODS, r.contact_method)}</span>
                    )}
                    {openFu > 0 && (
                      <span className="badge">Open FU: {openFu}</span>
                    )}
                  </div>
                  <div className="chip-row">
                    {(r.record_tags ?? []).map((rt) => (
                      <span key={rt.tag_id} className="chip on">{rt.tags?.name}</span>
                    ))}
                    {(caseLinks[r.id] ?? []).map((c) => (
                      <span key={c.id} className="chip case-chip" title={c.title}>
                        CASE · {c.title.length > 18 ? `${c.title.slice(0, 18)}…` : c.title}
                      </span>
                    ))}
                  </div>
                  <p>{r.content}</p>
                  <span className="muted small timeline-hint">클릭하여 상세 · Follow-up</span>
                </div>
              </li>
            )
          })}
          {filteredRecords.length === 0 && (
            <li className="muted">표시할 Record 없음</li>
          )}
        </ul>
      </section>

      <section className="card section-deep">
        <div className="page-header">
          <div>
            <h2>학생 더 깊게 보기</h2>
            <p className="muted small">
              Voice {trackingSummary.recentVoice} · Hypothesis{' '}
              {trackingSummary.activeHypotheses} · Intervention{' '}
              {trackingSummary.activeInterventions}
              {` · Obs ${observationCount}`}
            </p>
            <p className="muted small">
              평범한 관리는 Record / Focus / Follow-up으로 충분합니다. 필요할 때만 엽니다.
            </p>
          </div>
        </div>
        <div className="row wrap gap">
          <button
            type="button"
            className="btn small"
            onClick={() => setShowDetailedTracking(true)}
          >
            심층 추적
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => setShowPatterns(true)}
          >
            관찰 패턴
          </button>
          <Link
            className="btn ghost small"
            to={`/students/${student.id}/learning-profile`}
          >
            종합 프로필
          </Link>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setShowConsultation(true)}
          >
            상담 요약
          </button>
        </div>
      </section>

      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecordId(null)}
        onChanged={notifyChanged}
      />

      {showParentHistory && (
        <div className="modal-backdrop" onClick={() => setShowParentHistory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{MANAGEMENT_STATUS_LABEL} 이력</h2>
            <ul className="nested-list">
              {history.map((h) => (
                <li key={h.id}>
                  {new Date(h.changed_at).toLocaleString()} ·{' '}
                  {labelOf(PARENT_STATUSES, h.status)}
                  {h.reason ? ` — ${h.reason}` : ''}
                </li>
              ))}
              {history.length === 0 && <li className="muted">이력 없음</li>}
            </ul>
            <button type="button" className="btn" onClick={() => setShowParentHistory(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showClassHistory && (
        <div className="modal-backdrop" onClick={() => setShowClassHistory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Class History</h2>
            <ul className="nested-list">
              {classHistory.map((h) => (
                <li key={h.id}>
                  <strong>
                    {h.classes
                      ? formatClassDisplay({ ...h.classes, includeTerm: true })
                      : '반'}
                  </strong>
                  <div className="muted small">
                    {h.start_date}
                    {h.end_date ? ` ~ ${h.end_date}` : ' ~ Current'}
                    {h.is_current ? ' · current' : ''}
                  </div>
                  {h.note ? <div className="small">{h.note}</div> : null}
                </li>
              ))}
              {classHistory.length === 0 && (
                <li className="muted">반 이동/진급 이력이 없습니다.</li>
              )}
            </ul>
            <button type="button" className="btn" onClick={() => setShowClassHistory(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showMessages && (
        <StudentMessagesModal
          studentId={student.id}
          studentName={`${student.korean_name}${student.english_name ? ` / ${student.english_name}` : ''}`}
          onClose={() => setShowMessages(false)}
        />
      )}

      {showCaseForm && (
        <CaseFormModal
          studentId={student.id}
          onClose={() => setShowCaseForm(false)}
          onSaved={async () => {
            setShowCaseForm(false)
            await load()
            onDataChanged?.()
          }}
        />
      )}

      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onChanged={async () => {
            await load()
            onDataChanged?.()
          }}
          onOpenQuickRecord={({ studentId, caseId }) =>
            onOpenQuickRecord?.(studentId, caseId)
          }
        />
      )}

      {showDetailedTracking && (
        <div className="modal-backdrop" onClick={() => setShowDetailedTracking(false)}>
          <div
            className="modal message-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="page-header">
              <div>
                <h2 style={{ margin: 0 }}>심층 추적 · Detailed Tracking</h2>
                <p className="muted small" style={{ margin: 0 }}>
                  학생 자기보고 · 작업 가설 · 개입 및 반응
                </p>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowDetailedTracking(false)}
              >
                Close
              </button>
            </div>
            <DetailedTrackingPanel
              ctx={{ studentId: student.id }}
              defaultOpen
            />
          </div>
        </div>
      )}

      {showPatterns && (
        <PatternTrackerModal
          studentId={student.id}
          studentName={student.korean_name}
          onClose={() => setShowPatterns(false)}
          onOpenCase={(caseId) => {
            setShowPatterns(false)
            setSelectedCaseId(caseId)
          }}
        />
      )}

      {showConsultation && (
        <ConsultationSummaryModal
          studentId={student.id}
          onClose={() => setShowConsultation(false)}
          onSaved={async () => {
            await load()
            onDataChanged?.()
          }}
          onOpenMessages={() => {
            setShowConsultation(false)
            setShowMessages(true)
          }}
          onOpenPatterns={() => {
            setShowConsultation(false)
            setShowPatterns(true)
          }}
          createdBy={user?.id ?? null}
        />
      )}
    </div>
  )
}

function ParentStatusControl({
  student,
  onChanged,
}: {
  student: Student
  onChanged: () => Promise<void>
}) {
  const [status, setStatus] = useState(student.parent_management_status)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setStatus(student.parent_management_status)
  }, [student.parent_management_status])

  async function apply() {
    setBusy(true)
    setMsg(null)
    try {
      await changeParentStatus(student.id, status, reason.trim() || undefined)
      setReason('')
      await onChanged()
      setMsg('변경됨')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row wrap gap">
      <label className="inline">
        {MANAGEMENT_STATUS_LABEL}:
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ParentManagementStatus)}
        >
          {PARENT_STATUSES.map((x) => (
            <option key={x.value} value={x.value}>{x.label}</option>
          ))}
        </select>
      </label>
      <input
        placeholder="변경 사유"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="button"
        className="btn small"
        disabled={busy || status === student.parent_management_status}
        onClick={() => void apply()}
      >
        상태 변경
      </button>
      {msg && <span className="muted small">{msg}</span>}
    </div>
  )
}
