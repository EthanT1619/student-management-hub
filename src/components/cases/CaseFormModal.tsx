import { FormEvent, useState } from 'react'
import { createCase, updateCase } from '../../lib/api'
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  todayISO,
  type CasePriority,
  type CaseStatus,
  type CaseType,
} from '../../lib/constants'
import type { CaseRow } from '../../lib/types'
import { useAuth } from '../../context/AuthContext'

export function CaseFormModal({
  studentId,
  initial,
  onClose,
  onSaved,
}: {
  studentId: string
  initial?: CaseRow | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [caseType, setCaseType] = useState<CaseType | ''>(initial?.case_type ?? '')
  const [priority, setPriority] = useState<CasePriority>(initial?.priority ?? 'normal')
  const [status, setStatus] = useState<CaseStatus>(initial?.status ?? 'open')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [goal, setGoal] = useState(initial?.goal ?? '')
  const [openedAt, setOpenedAt] = useState(initial?.opened_at ?? todayISO())
  const [outcome, setOutcome] = useState(initial?.outcome ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (initial) {
        await updateCase(initial.id, {
          title,
          case_type: caseType || null,
          priority,
          status,
          summary,
          goal,
          opened_at: openedAt,
          closed_at: initial.closed_at,
          outcome,
        })
      } else {
        await createCase({
          student_id: studentId,
          title,
          case_type: caseType || null,
          priority,
          summary,
          goal,
          opened_at: openedAt,
          created_by: user?.id ?? null,
        })
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal message-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit Case' : 'New Case'}</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Title *
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="row wrap">
            <label>
              Type
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as CaseType | '')}
              >
                <option value="">미지정</option>
                {CASE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CasePriority)}
              >
                {CASE_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {initial && (
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus)}
                >
                  {CASE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Opened
              <input
                type="date"
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
              />
            </label>
          </div>
          <label>
            Summary
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </label>
          <label>
            Goal
            <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          {initial && (
            <label>
              Outcome
              <textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </label>
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
