import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createClass,
  createTerm,
  fetchClassListStats,
  fetchTerms,
  updateTerm,
} from '../lib/api'
import { DAYS_CODE_SELECT_OPTIONS, formatClassDisplay } from '../lib/classFormat'
import { todayISO } from '../lib/constants'
import type { DaysCode, TermRow } from '../lib/types'

interface ClassStat {
  classRow: Awaited<ReturnType<typeof fetchClassListStats>>[number]['classRow']
  studentCount: number
  openFollowupCount: number
  pendingStampCount: number
}

export function ClassesPage() {
  const [items, setItems] = useState<ClassStat[]>([])
  const [terms, setTerms] = useState<TermRow[]>([])
  const [termId, setTermId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [createdClassId, setCreatedClassId] = useState<string | null>(null)
  const [showTermForm, setShowTermForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState<TermRow | null>(null)

  async function reload(selectedTermId?: string) {
    const termList = await fetchTerms()
    setTerms(termList)
    const current = termList.find((t) => t.is_current) ?? termList[0] ?? null
    const activeTermId = selectedTermId || termId || current?.id || ''
    setTermId(activeTermId)
    if (!activeTermId) {
      setItems([])
      return
    }
    const all = await fetchClassListStats(activeTermId)
    setItems(all)
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeTerm = terms.find((t) => t.id === termId) ?? null

  return (
    <div className="page">
      <div className="page-header">
        <h1>Classes</h1>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setShowTermForm(true)}>
            + Term
          </button>
          <button type="button" className="btn primary" onClick={() => setShowForm(true)}>
            + Add Class
          </button>
        </div>
      </div>
      <p className="muted">
        Class = 학기 + Level + 요일 + 교시. 다음 학기/진급은 기존 반을 수정하지 말고 새 Class를
        만든 뒤 학생을 이동하세요.
      </p>

      <div className="filters row wrap">
        <label className="inline">
          학기
          <select
            value={termId}
            onChange={(e) => {
              const v = e.target.value
              setTermId(v)
              void reload(v).catch((err) =>
                setError(err instanceof Error ? err.message : 'Load failed'),
              )
            }}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_current ? ' (현재)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={!activeTerm}
          onClick={() => activeTerm && setEditingTerm(activeTerm)}
        >
          Edit Term
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="class-list">
        {items.map(({ classRow, studentCount, openFollowupCount, pendingStampCount }) => (
          <div key={classRow.id} className="class-card-wrap">
            <Link to={`/classes/${classRow.id}`} className="class-card">
              <h2>{formatClassDisplay(classRow)}</h2>
              <div className="muted">
                {activeTerm?.name ?? classRow.terms?.name} · 학생 {studentCount}명 · Open
                Follow-ups {openFollowupCount} · Pending Stamps {pendingStampCount}
              </div>
            </Link>
            <Link
              className="btn small class-card-action"
              to={`/dashboard?tab=before-class&classId=${classRow.id}`}
            >
              Before Class
            </Link>
          </div>
        ))}
        {items.length === 0 && (
          <p className="muted">이 학기에 등록된 반이 없습니다. + Add Class로 추가하세요.</p>
        )}
      </div>

      {createdClassId && (
        <div className="banner row between">
          <span>반이 저장되었습니다. 바로 학생을 추가할까요?</span>
          <div className="row gap">
            <Link className="btn primary small" to={`/students?add=1&classId=${createdClassId}`}>
              학생 추가
            </Link>
            <button type="button" className="btn ghost small" onClick={() => setCreatedClassId(null)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <ClassCreateForm
          terms={terms}
          defaultTermId={termId}
          onClose={() => setShowForm(false)}
          onSaved={async (created) => {
            setShowForm(false)
            setCreatedClassId(created.id)
            await reload(termId)
          }}
        />
      )}
      {showTermForm && (
        <TermCreateForm
          onClose={() => setShowTermForm(false)}
          onSaved={async (id) => {
            setShowTermForm(false)
            await reload(id)
          }}
        />
      )}
      {editingTerm && (
        <TermEditForm
          term={editingTerm}
          onClose={() => setEditingTerm(null)}
          onSaved={async (id) => {
            setEditingTerm(null)
            await reload(id)
          }}
        />
      )}
    </div>
  )
}

function ClassCreateForm({
  terms,
  defaultTermId,
  onClose,
  onSaved,
}: {
  terms: TermRow[]
  defaultTermId: string
  onClose: () => void
  onSaved: (created: Awaited<ReturnType<typeof createClass>>) => Promise<void>
}) {
  const [termId, setTermId] = useState(defaultTermId)
  const [levelName, setLevelName] = useState('')
  const [daysCode, setDaysCode] = useState<DaysCode>('MWF')
  const [period, setPeriod] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await createClass({
        level_name: levelName,
        days_code: daysCode,
        period,
        term_id: termId || null,
      })
      await onSaved(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const preview = formatClassDisplay({
    days_code: daysCode,
    period: period || 'UNSET',
    level_name: levelName.trim() || '레벨',
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Class</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            학기 *
            <select value={termId} onChange={(e) => setTermId(e.target.value)} required>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_current ? ' (현재)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Level *
            <input
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              placeholder="예: LSA1, DSC1"
              required
            />
          </label>
          <label>
            요일 *
            <select
              value={daysCode}
              onChange={(e) => setDaysCode(e.target.value as DaysCode)}
            >
              {DAYS_CODE_SELECT_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            교시 *
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="예: 2, 3.5"
              required
            />
          </label>
          <p className="muted">
            표시 미리보기: <strong>{preview}</strong>
          </p>
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

function TermCreateForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (termId: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [setCurrent, setSetCurrent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (endDate && endDate < startDate) {
      setError('종료일은 시작일보다 빠를 수 없습니다.')
      setSaving(false)
      return
    }
    try {
      const term = await createTerm({
        name,
        start_date: startDate,
        end_date: endDate || null,
        set_current: setCurrent,
      })
      await onSaved(term.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Term</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            학기 이름 *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 Fall"
              required
            />
          </label>
          <label>
            시작일 *
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label>
            종료일
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={setCurrent}
              onChange={(e) => setSetCurrent(e.target.checked)}
            />
            현재 학기로 설정
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

function TermEditForm({
  term,
  onClose,
  onSaved,
}: {
  term: TermRow
  onClose: () => void
  onSaved: (termId: string) => Promise<void>
}) {
  const [name, setName] = useState(term.name)
  const [startDate, setStartDate] = useState(term.start_date)
  const [endDate, setEndDate] = useState(term.end_date ?? '')
  const [isCurrent, setIsCurrent] = useState(term.is_current)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (endDate && endDate < startDate) {
      setError('종료일은 시작일보다 빠를 수 없습니다.')
      setSaving(false)
      return
    }
    try {
      await updateTerm({
        id: term.id,
        name,
        start_date: startDate,
        end_date: endDate || null,
        is_current: isCurrent,
        was_current: term.is_current,
      })
      await onSaved(term.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Term</h2>
        <p className="muted small">
          Term ID는 바뀌지 않습니다. 이름·기간만 수정되며, 연결된 Class와 Class History는
          그대로 유지됩니다.
        </p>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            학기 이름 *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            시작일 *
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label>
            종료일
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            현재 학기 (Current Term)
          </label>
          {term.is_current && (
            <p className="muted small">
              이 Term이 현재 Current입니다. 체크를 해제하려면 다른 Term을 편집해 Current로
              지정하세요.
            </p>
          )}
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
