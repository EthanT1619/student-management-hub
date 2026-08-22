import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import {
  addFollowup,
  completeFollowup,
  fetchCaseLinksForStudent,
  markStampGiven,
  pinRecordAsFocus,
  updateRecord,
} from '../lib/api'
import {
  CONTACT_METHODS,
  RECORD_TYPES,
  labelOf,
  todayISO,
} from '../lib/constants'
import type { Followup, RecordRow } from '../lib/types'
import { DetailedTrackingPanel } from './DetailedTrackingPanel'
import { AbcContextSection } from './AbcContextSection'
import { LinkCasePanel } from './LinkCasePanel'

interface Props {
  record: RecordRow | null
  onClose: () => void
  onChanged: () => Promise<void>
  startAddingFollowup?: boolean
}

export function RecordDetailModal({
  record,
  onClose,
  onChanged,
  startAddingFollowup = false,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [important, setImportant] = useState(false)
  const [addingFu, setAddingFu] = useState(false)
  const [fuNote, setFuNote] = useState('')
  const [fuDue, setFuDue] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'none' | 'case' | 'deep'>('none')
  const [linkedCases, setLinkedCases] = useState<{ id: string; title: string }[]>(
    [],
  )
  const [focusMsg, setFocusMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!record) return
    setContent(record.content)
    setImportant(record.is_important)
    setEditing(false)
    setAddingFu(startAddingFollowup)
    setFuNote('')
    setFuDue(todayISO())
    setError(null)
    setPanel('none')
    setFocusMsg(null)
    void fetchCaseLinksForStudent(record.student_id)
      .then((map) => setLinkedCases(map[record.id] ?? []))
      .catch(() => setLinkedCases([]))
  }, [record, startAddingFollowup])

  const followups = useMemo(() => {
    const list = [...(record?.followups ?? [])]
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return (a.due_date ?? '').localeCompare(b.due_date ?? '')
    })
    return list
  }, [record])

  if (!record) return null

  async function refresh() {
    await onChanged()
  }

  async function saveContent(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('내용을 입력하세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateRecord(record!.id, { content: content.trim() })
      setEditing(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function toggleImportant() {
    setBusy(true)
    setError(null)
    try {
      const next = !important
      await updateRecord(record!.id, { is_important: next })
      setImportant(next)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function saveFollowup(e: FormEvent) {
    e.preventDefault()
    if (!fuNote.trim()) {
      setError('Follow-up note를 입력하세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addFollowup({
        record_id: record!.id,
        due_date: fuDue || null,
        note: fuNote,
      })
      setFuNote('')
      setFuDue(todayISO())
      setAddingFu(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Follow-up 저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function markDone(fu: Followup) {
    setBusy(true)
    setError(null)
    try {
      await completeFollowup(fu.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '완료 처리 실패')
    } finally {
      setBusy(false)
    }
  }

  async function giveStamp() {
    setBusy(true)
    setError(null)
    try {
      await markStampGiven(record!.id, todayISO())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stamp 처리 실패')
    } finally {
      setBusy(false)
    }
  }

  async function pinFocus() {
    setBusy(true)
    setError(null)
    setFocusMsg(null)
    try {
      await pinRecordAsFocus({
        student_id: record!.student_id,
        record_date: record!.record_date,
        record_type: record!.record_type,
        content: record!.content,
        typeLabel: labelOf(RECORD_TYPES, record!.record_type),
      })
      setFocusMsg('현재 Focus로 고정했습니다.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Focus 고정 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal record-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="page-header">
          <h2 id="record-detail-title">Record Detail</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="stack">
          <div className="timeline-meta">
            <strong>{record.record_date}</strong>
            <span>{labelOf(RECORD_TYPES, record.record_type)}</span>
            {important && <span className="star">★ Important</span>}
          </div>

          <div className="chip-row">
            {(record.record_tags ?? []).length === 0 && (
              <span className="muted small">Tags 없음</span>
            )}
            {(record.record_tags ?? []).map((rt) => (
              <span key={rt.tag_id} className="chip on">
                {rt.tags?.name ?? rt.tag_id}
              </span>
            ))}
          </div>

          {editing ? (
            <form className="stack" onSubmit={(e) => void saveContent(e)}>
              <label>
                Content *
                <textarea
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </label>
              <div className="row end">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setEditing(false)
                    setContent(record.content)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className="record-detail-content">{record.content}</p>
          )}

          <div className="row wrap gap action-row-primary">
            <button
              type="button"
              className="btn primary small btn-nowrap"
              disabled={busy}
              onClick={() => setAddingFu(true)}
            >
              Follow-up
            </button>
            <button
              type="button"
              className="btn primary small btn-nowrap"
              disabled={busy}
              onClick={() => void pinFocus()}
            >
              Focus로 고정
            </button>
            <button
              type="button"
              className="btn primary small btn-nowrap"
              disabled={busy}
              onClick={() => setPanel(panel === 'case' ? 'none' : 'case')}
            >
              Case에 연결
            </button>
          </div>
          {focusMsg && <p className="muted small">{focusMsg}</p>}

          <div className="row wrap gap">
            <button
              type="button"
              className="btn ghost small btn-nowrap"
              disabled={busy}
              onClick={() => void toggleImportant()}
            >
              {important ? '★ Important' : '☆ Important'}
            </button>
            {!editing && (
              <button
                type="button"
                className="btn ghost small btn-nowrap"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
            {record.record_type === 'stamp' && record.stamp_status === 'pending' && (
              <button
                type="button"
                className="btn small btn-nowrap"
                disabled={busy}
                onClick={() => void giveStamp()}
              >
                Stamp Given
              </button>
            )}
          </div>

          {record.record_type === 'parent_contact' && (
            <p className="muted small">
              Contact:{' '}
              {record.contact_method
                ? labelOf(CONTACT_METHODS, record.contact_method)
                : '—'}
            </p>
          )}
          {record.record_type === 'stamp' && (
            <div className="chip-row">
              <span className="badge">+{record.stamp_amount}</span>
              <span className="badge">{record.stamp_status}</span>
            </div>
          )}

          {panel === 'case' && (
            <LinkCasePanel
              studentId={record.student_id}
              recordId={record.id}
              onCancel={() => setPanel('none')}
              onDone={async () => {
                setPanel('none')
                const map = await fetchCaseLinksForStudent(record.student_id)
                setLinkedCases(map[record.id] ?? [])
                await refresh()
              }}
            />
          )}

          {(linkedCases.length > 0 || followups.length > 0) && (
            <section className="stack nested">
              <h3 className="dt-subhead" style={{ textTransform: 'none' }}>
                연결된 항목
              </h3>
              {linkedCases.length > 0 && (
                <div className="chip-row">
                  {linkedCases.map((c) => (
                    <span key={c.id} className="chip on">
                      Case: {c.title}
                    </span>
                  ))}
                </div>
              )}
              <ul className="nested-list">
                {followups.map((f) => (
                  <li key={f.id}>
                    <strong>[{f.status}]</strong> {f.note}
                    <div className="muted small">Due: {f.due_date ?? '—'}</div>
                    {f.status === 'open' && (
                      <button
                        type="button"
                        className="btn ghost small"
                        disabled={busy}
                        onClick={() => void markDone(f)}
                      >
                        Mark Done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {addingFu && (
            <form className="stack nested" onSubmit={(e) => void saveFollowup(e)}>
              <h3 style={{ margin: 0 }}>Follow-up</h3>
              <label>
                Due date
                <input
                  type="date"
                  value={fuDue}
                  onChange={(e) => setFuDue(e.target.value)}
                />
              </label>
              <label>
                Note *
                <input
                  value={fuNote}
                  onChange={(e) => setFuNote(e.target.value)}
                  required
                />
              </label>
              <div className="row end">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setAddingFu(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  Save Follow-up
                </button>
              </div>
            </form>
          )}

          <div className="dt-block">
            <button
              type="button"
              className="btn ghost dt-block-toggle"
              onClick={() => setPanel(panel === 'deep' ? 'none' : 'deep')}
            >
              {panel === 'deep' ? '▾' : '▸'} 심층 기록 · Deep Tracking
            </button>
            {panel === 'deep' && (
              <div className="dt-block-body stack">
                <p className="muted small">
                  Context / ABC / 학생 발언 / 가설·개입은 필요할 때만 사용합니다.
                  {record.record_type === 'guidance' && (
                    <>
                      {' '}
                      지도(Guidance)의 개입 방식은 아래 Intervention으로 기록합니다.
                    </>
                  )}
                </p>
                <AbcContextSection record={record} onChanged={refresh} />
                <DetailedTrackingPanel
                  ctx={{ studentId: record.student_id, record }}
                  defaultOpen
                />
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export function openRecordOnKeyDown(e: KeyboardEvent, open: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open()
  }
}
