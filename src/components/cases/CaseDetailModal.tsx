import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  caseLinkedRecords,
  caseOpenFollowups,
  closeCase,
  fetchCase,
  fetchStudentRecords,
  linkRecordToCase,
  reopenCase,
  resolveCase,
} from '../../lib/api'
import { formatClassDisplay } from '../../lib/classFormat'
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  MANAGEMENT_STATUS_LABEL,
  PARENT_STATUSES,
  RECORD_TYPES,
  formatShortDate,
  labelOf,
} from '../../lib/constants'
import type { CaseRow, RecordRow } from '../../lib/types'
import {
  RecordDetailModal,
  openRecordOnKeyDown,
} from '../RecordDetailModal'
import { DetailedTrackingPanel } from '../DetailedTrackingPanel'
import { CaseFormModal } from './CaseFormModal'

export function CaseDetailModal({
  caseId,
  onClose,
  onChanged,
  onOpenQuickRecord,
}: {
  caseId: string
  onClose: () => void
  onChanged: () => void
  onOpenQuickRecord: (opts: { studentId: string; caseId: string }) => void
}) {
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)

  const load = useCallback(async () => {
    const c = await fetchCase(caseId)
    setCaseRow(c)
    setOutcomeDraft(c?.outcome ?? '')
  }, [caseId])

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [load])

  if (!caseRow && !error) return <p className="muted center-pad">Loading…</p>
  if (!caseRow) return <p className="error">{error}</p>

  const records = caseLinkedRecords(caseRow)
  const openFus = caseOpenFollowups(caseRow)
  const st = caseRow.students

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal message-detail-modal case-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="page-header">
          <div>
            <p className="muted small" style={{ margin: 0 }}>
              {st ? (
                <Link to={`/students/${st.id}`}>{st.korean_name}</Link>
              ) : (
                '학생'
              )}
              {st?.classes ? ` · ${formatClassDisplay(st.classes)}` : ''}
            </p>
            <h2 style={{ margin: '0.25rem 0' }}>{caseRow.title}</h2>
            <div className="chip-row">
              <span className={`badge badge-case-${caseRow.status}`}>
                {labelOf(CASE_STATUSES, caseRow.status)}
              </span>
              {caseRow.case_type && (
                <span className="badge">{labelOf(CASE_TYPES, caseRow.case_type)}</span>
              )}
              <span className={`badge badge-priority-${caseRow.priority}`}>
                {labelOf(CASE_PRIORITIES, caseRow.priority)}
              </span>
              {st && (
                <span className="badge">
                  {MANAGEMENT_STATUS_LABEL}{' '}
                  {labelOf(PARENT_STATUSES, st.parent_management_status)}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <p className="muted small">
          Opened {caseRow.opened_at}
          {caseRow.closed_at ? ` · Closed ${caseRow.closed_at}` : ''}
        </p>
        {caseRow.summary && (
          <section className="bc-section">
            <h3>Summary</h3>
            <pre className="message-body" style={{ maxHeight: '12rem' }}>
              {caseRow.summary}
            </pre>
          </section>
        )}
        {caseRow.goal && (
          <section className="bc-section">
            <h3>Goal</h3>
            <pre className="message-body" style={{ maxHeight: '12rem' }}>
              {caseRow.goal}
            </pre>
          </section>
        )}
        {caseRow.outcome && (
          <section className="bc-section">
            <h3>Outcome</h3>
            <pre className="message-body" style={{ maxHeight: '12rem' }}>
              {caseRow.outcome}
            </pre>
          </section>
        )}

        <section className="bc-section">
          <div className="page-header">
            <h3>Open Follow-ups ({openFus.length})</h3>
          </div>
          <ul className="nested-list">
            {openFus.map(({ record, followup }) => (
              <li key={followup.id}>
                {formatShortDate(followup.due_date)} · {followup.note}{' '}
                <span className="muted small">
                  ({labelOf(RECORD_TYPES, record.record_type)})
                </span>
              </li>
            ))}
            {openFus.length === 0 && <li className="muted">없음</li>}
          </ul>
        </section>

        <section className="bc-section">
          <div className="page-header">
            <h3>Timeline</h3>
            <div className="row wrap gap">
              <button
                type="button"
                className="btn primary small"
                onClick={() =>
                  onOpenQuickRecord({
                    studentId: caseRow.student_id,
                    caseId: caseRow.id,
                  })
                }
              >
                + New Record
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setLinking(true)}
              >
                Link Existing Record
              </button>
            </div>
          </div>
          <ul className="timeline">
            {records.map((r) => (
              <li key={r.id}>
                <div
                  className="timeline-item clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecord(r)}
                  onKeyDown={(e) =>
                    openRecordOnKeyDown(e, () => setSelectedRecord(r))
                  }
                >
                  <div className="timeline-meta">
                    <strong>{r.record_date}</strong>
                    <span>{labelOf(RECORD_TYPES, r.record_type)}</span>
                    {r.is_important && <span className="star">★</span>}
                  </div>
                  <p>{r.content}</p>
                </div>
              </li>
            ))}
            {records.length === 0 && (
              <li className="muted">연결된 Record 없음</li>
            )}
          </ul>
        </section>

        <DetailedTrackingPanel
          ctx={{
            studentId: caseRow.student_id,
            caseId: caseRow.id,
          }}
          defaultOpen={false}
        />

        <div className="row wrap gap end" style={{ marginTop: 'var(--space-4)' }}>
          {(caseRow.status === 'open' || caseRow.status === 'monitoring') && (
            <>
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  void resolveCase(caseRow.id, outcomeDraft || null)
                    .then(() => {
                      onChanged()
                      return load()
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'Failed'),
                    )
                }
              >
                Resolve
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() =>
                  void closeCase(caseRow.id, outcomeDraft || null)
                    .then(() => {
                      onChanged()
                      return load()
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'Failed'),
                    )
                }
              >
                Close
              </button>
            </>
          )}
          {(caseRow.status === 'resolved' || caseRow.status === 'closed') && (
            <button
              type="button"
              className="btn small"
              onClick={() =>
                void reopenCase(caseRow.id)
                  .then(() => {
                    onChanged()
                    return load()
                  })
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : 'Failed'),
                  )
              }
            >
              Reopen
            </button>
          )}
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>

        {(caseRow.status === 'open' || caseRow.status === 'monitoring') && (
          <label style={{ marginTop: 'var(--space-3)' }}>
            Outcome (Resolve/Close 시 저장)
            <textarea
              rows={2}
              value={outcomeDraft}
              onChange={(e) => setOutcomeDraft(e.target.value)}
            />
          </label>
        )}

        {editing && (
          <CaseFormModal
            studentId={caseRow.student_id}
            initial={caseRow}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false)
              await load()
              onChanged()
            }}
          />
        )}

        {linking && (
          <LinkRecordModal
            studentId={caseRow.student_id}
            caseId={caseRow.id}
            linkedIds={new Set((caseRow.case_records ?? []).map((x) => x.record_id))}
            onClose={() => setLinking(false)}
            onLinked={async () => {
              setLinking(false)
              await load()
              onChanged()
            }}
          />
        )}

        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onChanged={async () => {
            await load()
            onChanged()
            if (selectedRecord) {
              const refreshed = caseLinkedRecords(
                (await fetchCase(caseId))!,
              ).find((r) => r.id === selectedRecord.id)
              setSelectedRecord(refreshed ?? null)
            }
          }}
        />
      </div>
    </div>
  )
}

function LinkRecordModal({
  studentId,
  caseId,
  linkedIds,
  onClose,
  onLinked,
}: {
  studentId: string
  caseId: string
  linkedIds: Set<string>
  onClose: () => void
  onLinked: () => Promise<void>
}) {
  const [records, setRecords] = useState<RecordRow[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchStudentRecords(studentId)
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [studentId])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter && r.record_type !== typeFilter) return false
      if (importantOnly && !r.is_important) return false
      return true
    })
  }, [records, typeFilter, importantOnly])

  async function link(recordId: string) {
    setBusy(true)
    setError(null)
    try {
      await linkRecordToCase(caseId, recordId)
      await onLinked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal message-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Link Existing Record</h2>
        <p className="muted small">이 학생의 Record만 표시됩니다.</p>
        <div className="filters row wrap">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {RECORD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="inline">
            <input
              type="checkbox"
              checked={importantOnly}
              onChange={(e) => setImportantOnly(e.target.checked)}
            />
            Important
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <ul className="nested-list">
          {filtered.map((r) => {
            const linked = linkedIds.has(r.id)
            return (
              <li key={r.id}>
                <strong>{r.record_date}</strong> · {labelOf(RECORD_TYPES, r.record_type)}
                <div className="muted small">{r.content.slice(0, 80)}</div>
                {linked ? (
                  <span className="badge">Already linked</span>
                ) : (
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy}
                    onClick={() => void link(r.id)}
                  >
                    Link
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
