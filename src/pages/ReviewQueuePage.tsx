import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  completeFocusItem,
  fetchClasses,
  fetchCurrentTerm,
  fetchRecordById,
  fetchReviewQueue,
  upsertReviewAction,
} from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  MANAGEMENT_STATUS_LABEL,
  PARENT_STATUSES,
  REVIEW_RULE_LABELS,
  REVIEW_SNOOZE_OPTIONS_DAYS,
  daysAfterISO,
  formatShortDate,
  labelOf,
  todayISO,
  type ReviewRuleType,
} from '../lib/constants'
import type { ReviewItem, ReviewStudentGroup } from '../lib/reviewQueue'
import type { ClassRow, RecordRow } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { RecordDetailModal } from '../components/RecordDetailModal'

type RuleFilter = 'all' | ReviewRuleType

export function ReviewQueuePage({
  refreshKey,
  onOpenQuickRecord,
}: {
  refreshKey: number
  onOpenQuickRecord: (studentId: string) => void
}) {
  const { user } = useAuth()
  const asOfDate = todayISO()

  const [groups, setGroups] = useState<ReviewStudentGroup[]>([])
  const [summary, setSummary] = useState({
    all: 0,
    stale_focus: 0,
    observation_without_followup: 0,
    parent_contact_without_followup: 0,
    student_without_recent_record: 0,
  })
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all')
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [startAddingFu, setStartAddingFu] = useState(false)

  const reload = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const term = await fetchCurrentTerm()
      const termClasses = term ? await fetchClasses(term.id) : []
      setClasses(
        [...termClasses].sort((a, b) =>
          formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
        ),
      )
      const payload = await fetchReviewQueue(user.id, asOfDate)
      setGroups(payload.groups)
      setSummary(payload.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [user?.id, asOfDate])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => {
        let items = g.items
        if (classId) {
          items = items.filter((i) => i.student.class_id === classId)
        }
        if (ruleFilter !== 'all') {
          items = items.filter((i) => i.ruleType === ruleFilter)
        }
        if (items.length === 0) return null
        return {
          ...g,
          items,
          maxAgeDays: Math.max(...items.map((i) => i.ageDays)),
        }
      })
      .filter(Boolean) as ReviewStudentGroup[]
  }, [groups, classId, ruleFilter])

  async function openRecord(recordId: string, addFu = false) {
    try {
      const full = await fetchRecordById(recordId)
      if (full) {
        setStartAddingFu(addFu)
        setSelectedRecord(full)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Record load failed')
    }
  }

  async function onDismiss(item: ReviewItem) {
    if (!user?.id) return
    await upsertReviewAction({
      user_id: user.id,
      student_id: item.student.id,
      rule_type: item.ruleType,
      source_type: item.sourceType,
      source_id: item.sourceId,
      trigger_key: item.triggerKey,
      action: 'dismissed',
      snoozed_until: null,
    })
    await reload()
  }

  async function onSnooze(item: ReviewItem, days: number) {
    if (!user?.id) return
    await upsertReviewAction({
      user_id: user.id,
      student_id: item.student.id,
      rule_type: item.ruleType,
      source_type: item.sourceType,
      source_id: item.sourceId,
      trigger_key: item.triggerKey,
      action: 'snoozed',
      snoozed_until: daysAfterISO(asOfDate, days),
    })
    await reload()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Review Queue</h1>
          <p className="muted" style={{ margin: 0 }}>
            다시 확인할 가치가 있는 학생 관리 항목 · 기준일 {asOfDate}
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="kpi-row review-summary">
          <div className="kpi">전체 {summary.all}</div>
          <div className="kpi">오래된 Focus {summary.stale_focus}</div>
          <div className="kpi">Observation 후속 {summary.observation_without_followup}</div>
          <div className="kpi">Parent Contact 후속 {summary.parent_contact_without_followup}</div>
          <div className="kpi">최근 기록 없음 {summary.student_without_recent_record}</div>
        </div>
      </section>

      <div className="filters row wrap">
        <div className="tabs" role="tablist">
          <button
            type="button"
            className={`btn small ${ruleFilter === 'all' ? 'primary' : 'ghost'}`}
            onClick={() => setRuleFilter('all')}
          >
            All
          </button>
          {REVIEW_RULE_LABELS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`btn small ${ruleFilter === r.value ? 'primary' : 'ghost'}`}
              onClick={() => setRuleFilter(r.value)}
            >
              {r.short}
            </button>
          ))}
        </div>
        <label className="inline">
          Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">전체 반</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {formatClassDisplay(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && filteredGroups.length === 0 && (
        <section className="card empty-state">
          <h2>확인할 Review 항목이 없습니다.</h2>
          <p className="muted">
            오래된 Focus, Observation/Parent Contact 후 후속 기록 공백, 최근 기록 없음
            조건에 해당하는 항목이 없습니다.
          </p>
        </section>
      )}

      <div className="review-list">
        {filteredGroups.map((group) => (
          <StudentReviewCard
            key={group.student.id}
            group={group}
            onOpenQuickRecord={onOpenQuickRecord}
            onOpenRecord={openRecord}
            onDismiss={(item) => void onDismiss(item)}
            onSnooze={(item, days) => void onSnooze(item, days)}
            onFocusDone={async (focusId) => {
              await completeFocusItem(focusId)
              await reload()
            }}
          />
        ))}
      </div>

      <RecordDetailModal
        record={selectedRecord}
        startAddingFollowup={startAddingFu}
        onClose={() => {
          setSelectedRecord(null)
          setStartAddingFu(false)
        }}
        onChanged={async () => {
          await reload()
          if (selectedRecord) {
            const full = await fetchRecordById(selectedRecord.id)
            setSelectedRecord(full)
          }
        }}
      />
    </div>
  )
}

function StudentReviewCard({
  group,
  onOpenQuickRecord,
  onOpenRecord,
  onDismiss,
  onSnooze,
  onFocusDone,
}: {
  group: ReviewStudentGroup
  onOpenQuickRecord: (studentId: string) => void
  onOpenRecord: (recordId: string, addFu?: boolean) => Promise<void>
  onDismiss: (item: ReviewItem) => void
  onSnooze: (item: ReviewItem, days: number) => void
  onFocusDone: (focusId: string) => Promise<void>
}) {
  const { student, items } = group

  return (
    <article className="card review-student-card">
      <div className="page-header">
        <div>
          <h2 className="before-class-name">
            {student.accent_color && (
              <span className={`accent-dot accent-${student.accent_color}`} />
            )}
            {student.korean_name}
            {student.english_name ? ` / ${student.english_name}` : ''}
          </h2>
          <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
            {student.classes
              ? formatClassDisplay({ ...student.classes, includeTerm: true })
              : '반 미지정'}
          </p>
          <div className="row wrap gap" style={{ marginTop: 'var(--space-2)' }}>
            <span className="muted small">{MANAGEMENT_STATUS_LABEL}</span>
            <span className={`badge badge-mgmt ${student.parent_management_status}`}>
              {labelOf(PARENT_STATUSES, student.parent_management_status)}
            </span>
            <span className="badge">확인할 항목 {items.length}</span>
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
            학생 보기
          </Link>
        </div>
      </div>

      <ul className="review-item-list">
        {items.map((item) => (
          <li key={item.id} className="review-item">
            <div className="review-item-head">
              <span className="badge">
                {REVIEW_RULE_LABELS.find((r) => r.value === item.ruleType)?.short ??
                  item.ruleType}
              </span>
              <strong>{item.title}</strong>
            </div>
            {item.ruleType === 'stale_focus' && item.focus && (
              <p className="review-detail">
                <strong>{item.focus.title}</strong>
                {item.focus.note ? ` — ${item.focus.note}` : ''}
              </p>
            )}
            {(item.ruleType === 'observation_without_followup' ||
              item.ruleType === 'parent_contact_without_followup') &&
              item.record && (
                <p className="review-detail">
                  <span className="muted small">
                    {formatShortDate(item.record.record_date)}
                  </span>
                  <br />
                  {item.detail.length > 120
                    ? `${item.detail.slice(0, 120)}…`
                    : item.detail}
                </p>
              )}
            {item.ruleType === 'student_without_recent_record' && (
              <p className="review-detail muted">
                {item.lastRecord
                  ? `Last Record ${formatShortDate(item.lastRecord.record_date)} · ${item.lastRecord.record_type}`
                  : '기록 없음'}
              </p>
            )}

            <div className="row wrap gap review-actions">
              {item.record && (
                <>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => void onOpenRecord(item.record!.id, false)}
                  >
                    원본 Record
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => void onOpenRecord(item.record!.id, true)}
                  >
                    Follow-up 추가
                  </button>
                </>
              )}
              {item.focus && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void onFocusDone(item.focus!.id)}
                >
                  Focus 완료
                </button>
              )}
              {item.lastRecord && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void onOpenRecord(item.lastRecord!.id, false)}
                >
                  Last Record
                </button>
              )}
              <SnoozeMenu onPick={(days) => onSnooze(item, days)} />
              <button
                type="button"
                className="btn ghost small"
                onClick={() => onDismiss(item)}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

function SnoozeMenu({ onPick }: { onPick: (days: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="snooze-wrap">
      <button type="button" className="btn ghost small" onClick={() => setOpen((v) => !v)}>
        Snooze
      </button>
      {open && (
        <span className="snooze-options">
          {REVIEW_SNOOZE_OPTIONS_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className="btn small"
              onClick={() => {
                setOpen(false)
                onPick(d)
              }}
            >
              {d}일
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
