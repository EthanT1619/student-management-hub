import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  completeFollowup,
  fetchBeforeClassBundle,
  fetchClasses,
  fetchRecordById,
  fetchTerms,
  markStampGiven,
} from '../lib/api'
import {
  studentNeedsAttention,
  type BeforeClassStudentBundle,
} from '../lib/beforeClass'
import { formatClassDisplay } from '../lib/classFormat'
import {
  IMPORTANT_RECORD_LOOKBACK_DAYS,
  MANAGEMENT_STATUS_LABEL,
  PARENT_STATUSES,
  RECORD_TYPES,
  formatShortDate,
  labelOf,
  todayISO,
} from '../lib/constants'
import type { ClassRow, RecordRow, TermRow } from '../lib/types'
import {
  RecordDetailModal,
  openRecordOnKeyDown,
} from '../components/RecordDetailModal'

type ViewMode = 'attention' | 'all'

export function BeforeClassPage({
  refreshKey,
  onOpenQuickRecord,
  embedded = false,
}: {
  refreshKey: number
  onOpenQuickRecord: (studentId: string) => void
  /** When true, omit duplicate page chrome (used inside Dashboard tab). */
  embedded?: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const asOfDate = todayISO()
  const urlClassId = searchParams.get('classId') ?? ''

  const [terms, setTerms] = useState<TermRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState(urlClassId)
  const [bundles, setBundles] = useState<BeforeClassStudentBundle[]>([])
  const [view, setView] = useState<ViewMode>('attention')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [metaReady, setMetaReady] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const termList = await fetchTerms()
        setTerms(termList)
        const preferred = urlClassId

        if (preferred) {
          const allClasses = await fetchClasses()
          const found = allClasses.find((c) => c.id === preferred)
          if (found) {
            const termClasses = await fetchClasses(found.term_id)
            const sorted = [...termClasses].sort((a, b) =>
              formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
            )
            setClasses(sorted)
            setTermId(found.term_id)
            setClassId(found.id)
            setMetaReady(true)
            return
          }
        }

        const current = termList.find((t) => t.is_current) ?? termList[0] ?? null
        const nextTermId = current?.id ?? ''
        setTermId(nextTermId)
        if (!nextTermId) {
          setClasses([])
          setClassId('')
          setMetaReady(true)
          return
        }
        const termClasses = await fetchClasses(nextTermId)
        const sorted = [...termClasses].sort((a, b) =>
          formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
        )
        setClasses(sorted)
        const pick = sorted[0]?.id ?? ''
        setClassId(pick)
        if (pick) {
          const next = new URLSearchParams()
          next.set('classId', pick)
          if (embedded) next.set('tab', 'before-class')
          setSearchParams(next, { replace: true })
        }
        setMetaReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
        setMetaReady(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadBundle = useCallback(async (cid: string) => {
    if (!cid) {
      setBundles([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchBeforeClassBundle(
        cid,
        asOfDate,
        IMPORTANT_RECORD_LOOKBACK_DAYS,
      )
      setBundles(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => {
    if (!metaReady) return
    void loadBundle(classId)
  }, [metaReady, classId, loadBundle, refreshKey])

  function writeClassParam(nextClassId: string) {
    const next = new URLSearchParams(searchParams)
    if (nextClassId) next.set('classId', nextClassId)
    else next.delete('classId')
    if (embedded) next.set('tab', 'before-class')
    setSearchParams(next, { replace: true })
  }

  async function onTermChange(nextTermId: string) {
    setTermId(nextTermId)
    setError(null)
    try {
      const termClasses = await fetchClasses(nextTermId)
      const sorted = [...termClasses].sort((a, b) =>
        formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
      )
      setClasses(sorted)
      const next = sorted[0]?.id ?? ''
      setClassId(next)
      writeClassParam(next)
      setView('attention')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }

  function onClassChange(nextClassId: string) {
    setClassId(nextClassId)
    writeClassParam(nextClassId)
    setView('attention')
  }

  async function reloadCurrent() {
    if (!classId) return
    await loadBundle(classId)
  }

  const selectedClass = classes.find((c) => c.id === classId) ?? null
  const selectedTerm = terms.find((t) => t.id === termId) ?? null

  const attentionList = useMemo(
    () => bundles.filter(studentNeedsAttention),
    [bundles],
  )

  async function openImportantRecord(id: string) {
    try {
      const full = await fetchRecordById(id)
      if (full) setSelectedRecord(full)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Record load failed')
    }
  }

  return (
    <div className={embedded ? 'before-class-embedded' : 'page'}>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Before Class</h1>
            <p className="muted" style={{ margin: 0 }}>
              기준일: {asOfDate} · 수업 직전 10초 스캔
            </p>
          </div>
        </div>
      )}
      {embedded && (
        <p className="muted small" style={{ marginTop: 0 }}>
          기준일: {asOfDate} · 수업 직전 10초 스캔
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="filters row wrap">
          <label>
            학기
            <select value={termId} onChange={(e) => void onTermChange(e.target.value)}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_current ? ' (현재)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select
              value={classId}
              onChange={(e) => onClassChange(e.target.value)}
              disabled={classes.length === 0}
            >
              {classes.length === 0 && <option value="">반 없음</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassDisplay(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedClass && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            {selectedTerm?.name ?? selectedClass.terms?.name} ·{' '}
            {formatClassDisplay(selectedClass)} · 전체 {bundles.length}명
          </p>
        )}
      </section>

      <div className="tabs before-class-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'attention'}
          className={`btn ${view === 'attention' ? 'primary' : 'ghost'}`}
          onClick={() => setView('attention')}
        >
          Needs Attention ({attentionList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'all'}
          className={`btn ${view === 'all' ? 'primary' : 'ghost'}`}
          onClick={() => setView('all')}
        >
          All Students ({bundles.length})
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && classId && view === 'attention' && attentionList.length === 0 && (
        <section className="card empty-state">
          <h2>오늘 특별히 확인할 학생이 없습니다.</h2>
          <p className="muted">
            현재 이 반의 Due/Overdue Follow-up, Pending Stamp, 집중/장기위험생,
            Current Focus, 최근 Important Record가 없습니다.
          </p>
          <button type="button" className="btn" onClick={() => setView('all')}>
            전체 학생 보기
          </button>
        </section>
      )}

      {!loading && view === 'attention' && attentionList.length > 0 && (
        <p className="muted">
          오늘 챙길 학생 <strong>{attentionList.length}</strong>명
        </p>
      )}

      {!loading && view === 'all' && (
        <div className="before-class-list">
          {bundles.map((item) => (
            <AllStudentCompact
              key={item.student.id}
              item={item}
              onOpenQuickRecord={onOpenQuickRecord}
            />
          ))}
          {bundles.length === 0 && (
            <p className="muted">이 반에 배정된 학생이 없습니다.</p>
          )}
        </div>
      )}

      {!loading && view === 'attention' && attentionList.length > 0 && (
        <div className="before-class-list">
          {attentionList.map((item) => (
            <AttentionCard
              key={item.student.id}
              item={item}
              asOfDate={asOfDate}
              onOpenQuickRecord={onOpenQuickRecord}
              onOpenRecord={(id) => void openImportantRecord(id)}
              onChanged={() => void reloadCurrent()}
            />
          ))}
        </div>
      )}

      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onChanged={async () => {
          await reloadCurrent()
          if (selectedRecord) {
            const full = await fetchRecordById(selectedRecord.id)
            setSelectedRecord(full)
          }
        }}
      />
    </div>
  )
}

function AttentionCard({
  item,
  asOfDate,
  onOpenQuickRecord,
  onOpenRecord,
  onChanged,
}: {
  item: BeforeClassStudentBundle
  asOfDate: string
  onOpenQuickRecord: (studentId: string) => void
  onOpenRecord: (recordId: string) => void
  onChanged: () => void
}) {
  const { student } = item
  const focusShown = item.openFocus.slice(0, 3)
  const actionableFu = [...item.overdueFollowups, ...item.dueTodayFollowups]

  return (
    <article className="card before-class-card">
      <div className="page-header">
        <div>
          <h2 className="before-class-name">
            {student.accent_color && (
              <span className={`accent-dot accent-${student.accent_color}`} />
            )}
            {student.korean_name}
            {student.english_name ? ` / ${student.english_name}` : ''}
          </h2>
          <div className="row wrap gap" style={{ marginTop: 'var(--space-2)' }}>
            <span className="muted small">{MANAGEMENT_STATUS_LABEL}</span>
            <span className={`badge badge-mgmt ${student.parent_management_status}`}>
              {labelOf(PARENT_STATUSES, student.parent_management_status)}
            </span>
          </div>
          <div className="chip-row" style={{ marginTop: 'var(--space-2)' }}>
            {item.overdueFollowups.length > 0 && (
              <span className="badge badge-overdue">
                Overdue Follow-up {item.overdueFollowups.length}
              </span>
            )}
            {item.dueTodayFollowups.length > 0 && (
              <span className="badge">Due Today {item.dueTodayFollowups.length}</span>
            )}
            {item.openFocus.length > 0 && (
              <span className="badge">Focus {item.openFocus.length}</span>
            )}
            {item.pendingStamps.length > 0 && (
              <span className="badge">Stamp pending {item.pendingStamps.length}</span>
            )}
            {item.importantRecords.length > 0 && (
              <span className="badge">Important {item.importantRecords.length}</span>
            )}
          </div>
        </div>
        <div className="row wrap gap">
          <button
            type="button"
            className="btn primary small"
            onClick={() => onOpenQuickRecord(student.id)}
          >
            + Record
          </button>
          <Link className="btn small" to={`/students/${student.id}`}>
            Open Profile
          </Link>
        </div>
      </div>

      {actionableFu.length > 0 && (
        <section className="bc-section">
          <h3>Follow-up</h3>
          <ul className="focus-list">
            {actionableFu.map((f) => {
              const overdue = Boolean(f.due_date && f.due_date < asOfDate)
              return (
                <li key={f.id}>
                  <span className={overdue ? 'badge badge-overdue' : 'badge'}>
                    {overdue ? 'OVERDUE' : 'DUE'}
                  </span>
                  <span className="muted small">{formatShortDate(f.due_date)}</span>
                  <span className="grow">{f.note}</span>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => void completeFollowup(f.id).then(onChanged)}
                  >
                    Mark Done
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {focusShown.length > 0 && (
        <section className="bc-section">
          <h3>Current Focus</h3>
          <ul className="nested-list">
            {focusShown.map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong>
                {f.note ? <span className="muted"> — {f.note}</span> : null}
              </li>
            ))}
            {item.openFocus.length > 3 && (
              <li className="muted small">+{item.openFocus.length - 3} more</li>
            )}
          </ul>
        </section>
      )}

      {item.pendingStamps.length > 0 && (
        <section className="bc-section">
          <h3>Pending Stamp</h3>
          <ul className="focus-list">
            {item.pendingStamps.map((s) => (
              <li key={s.id}>
                <strong>+{s.stamp_amount ?? 1}</strong>
                <span className="grow">{s.content}</span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void markStampGiven(s.id, asOfDate).then(onChanged)}
                >
                  Mark Given
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.importantRecords.length > 0 && (
        <section className="bc-section">
          <h3>Important Record</h3>
          <ul className="focus-list">
            {item.importantRecords.map((r) => (
              <li
                key={r.id}
                className="clickable-row"
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecord(r.id)}
                onKeyDown={(e) => openRecordOnKeyDown(e, () => onOpenRecord(r.id))}
              >
                <span className="star">★</span>
                <span>
                  {formatShortDate(r.record_date)} ·{' '}
                  {labelOf(RECORD_TYPES, r.record_type)}
                  {(r.record_tags ?? []).length > 0 && (
                    <>
                      {' · '}
                      {(r.record_tags ?? [])
                        .map((t) => t.tags?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </>
                  )}
                  <div className="muted small">
                    {r.content.length > 80 ? `${r.content.slice(0, 80)}…` : r.content}
                  </div>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

function AllStudentCompact({
  item,
  onOpenQuickRecord,
}: {
  item: BeforeClassStudentBundle
  onOpenQuickRecord: (studentId: string) => void
}) {
  const { student } = item
  const openFu =
    item.overdueFollowups.length +
    item.dueTodayFollowups.length +
    item.upcomingFollowups.length

  return (
    <article className="card before-class-card compact">
      <div className="page-header">
        <div>
          <h2 className="before-class-name">
            {student.accent_color && (
              <span className={`accent-dot accent-${student.accent_color}`} />
            )}
            {student.korean_name}
            {student.english_name ? ` / ${student.english_name}` : ''}
          </h2>
          <div className="row wrap gap" style={{ marginTop: 'var(--space-2)' }}>
            <span className={`badge badge-mgmt ${student.parent_management_status}`}>
              {labelOf(PARENT_STATUSES, student.parent_management_status)}
            </span>
            <span className="muted small">
              Focus {item.openFocus.length} · Follow-up {openFu} · Stamp{' '}
              {item.pendingStamps.length}
            </span>
          </div>
        </div>
        <div className="row wrap gap">
          <button
            type="button"
            className="btn primary small"
            onClick={() => onOpenQuickRecord(student.id)}
          >
            + Record
          </button>
          <Link className="btn small" to={`/students/${student.id}`}>
            Open Profile
          </Link>
        </div>
      </div>
    </article>
  )
}
