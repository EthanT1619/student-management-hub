import { FormEvent, useEffect, useState } from 'react'
import {
  createCase,
  fetchCasesForStudent,
  linkRecordToCase,
} from '../lib/api'
import { CASE_PRIORITIES, CASE_STATUSES, labelOf } from '../lib/constants'
import type { CaseRow } from '../lib/types'
import { useAuth } from '../context/AuthContext'

/** Link a record to an existing or new Case (no schema change). */
export function LinkCasePanel({
  studentId,
  recordId,
  onDone,
  onCancel,
}: {
  studentId: string
  recordId: string
  onDone: () => Promise<void> | void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')

  useEffect(() => {
    void fetchCasesForStudent(studentId, true)
      .then(setCases)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [studentId])

  async function link(caseId: string) {
    setBusy(true)
    setError(null)
    try {
      await linkRecordToCase(caseId, recordId)
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결 실패')
    } finally {
      setBusy(false)
    }
  }

  async function createAndLink(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await createCase({
        student_id: studentId,
        title: title.trim(),
        created_by: user?.id ?? null,
      })
      await linkRecordToCase(created.id, recordId)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack nested link-case-panel">
      <p className="muted small" style={{ margin: 0 }}>
        여러 기록을 장기간 하나의 주제로 묶습니다.
      </p>
      {error && <p className="error">{error}</p>}
      <ul className="nested-list">
        {cases.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="btn small"
              disabled={busy}
              onClick={() => void link(c.id)}
            >
              연결: {c.title}
            </button>
            <span className="badge" style={{ marginLeft: '0.35rem' }}>
              {labelOf(CASE_STATUSES, c.status)}
            </span>
            <span className="badge">
              {labelOf(CASE_PRIORITIES, c.priority)}
            </span>
          </li>
        ))}
        {cases.length === 0 && !creating && (
          <li className="muted">Active Case 없음</li>
        )}
      </ul>
      {!creating ? (
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setCreating(true)}
        >
          + 새 Case 만들기
        </button>
      ) : (
        <form className="stack nested" onSubmit={(e) => void createAndLink(e)}>
          <label>
            Case 제목 *
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="예: 숙제 수행 습관"
            />
          </label>
          <div className="row wrap gap end">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              만들고 연결
            </button>
          </div>
        </form>
      )}
      <button type="button" className="btn ghost small" onClick={onCancel}>
        닫기
      </button>
    </div>
  )
}
