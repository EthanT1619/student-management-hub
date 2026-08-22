import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchClass,
  fetchClassLinkage,
  fetchClassStudentSummaries,
  updateClass,
  type ClassStudentSummary,
} from '../lib/api'
import {
  DAYS_CODE_SELECT_OPTIONS,
  daysCodeLabel,
  formatClassDisplay,
} from '../lib/classFormat'
import { MANAGEMENT_STATUS_LABEL, PARENT_STATUSES, labelOf } from '../lib/constants'
import type { ClassRow, DaysCode } from '../lib/types'

export function ClassDetailPage() {
  const { id } = useParams()
  const [classRow, setClassRow] = useState<ClassRow | null>(null)
  const [summaries, setSummaries] = useState<ClassStudentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showEditWarning, setShowEditWarning] = useState(false)
  const [linkageLoading, setLinkageLoading] = useState(false)

  async function reload() {
    if (!id) return
    const [c, s] = await Promise.all([fetchClass(id), fetchClassStudentSummaries(id)])
    setClassRow(c)
    setSummaries(s)
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function onClickEditClass() {
    if (!id) return
    setLinkageLoading(true)
    setError(null)
    try {
      const linkage = await fetchClassLinkage(id)
      if (linkage.hasLinkedHistory) {
        setShowEditWarning(true)
      } else {
        setShowEdit(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLinkageLoading(false)
    }
  }

  if (error && !classRow) return <p className="error">{error}</p>
  if (!classRow) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/classes">← Classes</Link>
      </p>
      {error && <p className="error">{error}</p>}
      <section className="card">
        <div className="page-header">
          <div>
            <h1>{formatClassDisplay(classRow)}</h1>
            <p className="muted">
              {classRow.terms?.name ?? '학기'} · 학생 {summaries.length}명
            </p>
          </div>
          <div className="row wrap gap">
            <Link className="btn primary" to={`/dashboard?tab=before-class&classId=${classRow.id}`}>
              Before Class
            </Link>
            <Link className="btn" to={`/messages?classId=${classRow.id}`}>
              Messages
            </Link>
            <Link className="btn" to={`/work-notes?classId=${classRow.id}`}>
              Work Notes
            </Link>
            <button
              type="button"
              className="btn"
              disabled={linkageLoading}
              onClick={() => void onClickEditClass()}
            >
              {linkageLoading ? '확인 중…' : 'Edit Class'}
            </button>
          </div>
        </div>
        <p className="muted small">
          학기 변경·진급용으로 이 반을 고치지 마세요. 오타/요일·교시·Level 표기 수정만
          허용됩니다. 다음 학기는 새 Class를 만드세요.
        </p>
      </section>

      <div className="class-roster">
        {summaries.map(({ student, focusTitles, openFollowupCount, pendingStampCount }) => (
          <Link
            key={student.id}
            to={`/students/${student.id}`}
            className="class-card student-roster-card"
          >
            <h2>
              {student.korean_name}
              {student.english_name ? ` / ${student.english_name}` : ''}
            </h2>
            <div className="muted">
              {MANAGEMENT_STATUS_LABEL}:{' '}
              <span className={`badge badge-mgmt ${student.parent_management_status}`}>
                {labelOf(PARENT_STATUSES, student.parent_management_status)}
              </span>
            </div>
            <div className="muted">
              Current Focus: {focusTitles.length ? focusTitles.join(' · ') : '없음'}
            </div>
            <div className="muted">
              Open Follow-ups {openFollowupCount} · Pending Stamps {pendingStampCount}
            </div>
          </Link>
        ))}
        {summaries.length === 0 && (
          <p className="muted">이 반에 배정된 학생이 없습니다. Students에서 반을 지정하세요.</p>
        )}
      </div>

      {showEditWarning && (
        <div className="modal-backdrop" onClick={() => setShowEditWarning(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Class 수정 주의</h2>
            <div className="stack">
              <p>이 반에는 학생 이력이 연결되어 있습니다.</p>
              <p>
                Level, 요일 또는 교시를 수정하면 이 반에 연결된 과거 Class History의 표시도
                함께 변경될 수 있습니다.
              </p>
              <p>
                학기 변경이나 진급을 위한 수정이라면 취소하고 새 Class를 만든 뒤 학생을
                이동해주세요.
              </p>
              <p>
                <strong>현재 수정이 오타 또는 실제 반 정보 정정 목적이 맞습니까?</strong>
              </p>
            </div>
            <div className="row end" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowEditWarning(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setShowEditWarning(false)
                  setShowEdit(true)
                }}
              >
                계속 수정
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <ClassEditForm
          classRow={classRow}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            setShowEdit(false)
            await reload()
          }}
        />
      )}
    </div>
  )
}

function ClassEditForm({
  classRow,
  onClose,
  onSaved,
}: {
  classRow: ClassRow
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [levelName, setLevelName] = useState(classRow.levels?.name ?? '')
  const [daysCode, setDaysCode] = useState<DaysCode | string>(classRow.days_code)
  const [period, setPeriod] = useState(classRow.period)
  const [isActive, setIsActive] = useState(classRow.is_active)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateClass({
        class_id: classRow.id,
        level_name: levelName,
        days_code: daysCode,
        period,
        is_active: isActive,
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Class (운영/오타 수정)</h2>
        <p className="muted small">
          학기(term)는 변경할 수 없습니다. 현재 학기: {classRow.terms?.name ?? '—'}
        </p>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Level *
            <input value={levelName} onChange={(e) => setLevelName(e.target.value)} required />
          </label>
          <label>
            요일 *
            <select value={daysCode} onChange={(e) => setDaysCode(e.target.value)}>
              {!DAYS_CODE_SELECT_OPTIONS.some((x) => x.value === daysCode) && (
                <option value={daysCode}>
                  {daysCodeLabel(String(daysCode))} (기존값 — 월수금/화목으로 변경하세요)
                </option>
              )}
              {DAYS_CODE_SELECT_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            교시 *
            <input value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row end">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
