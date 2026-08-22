import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addWorkFollowup,
  completeWorkFollowup,
  createWorkNote,
  fetchClasses,
  fetchCurrentTerm,
  fetchStudents,
  fetchWorkNote,
  fetchWorkNotes,
  setWorkNoteStatus,
  toggleWorkNoteImportant,
  updateWorkNote,
} from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  WORK_NOTE_STATUSES,
  WORK_NOTE_TYPES,
  formatShortDate,
  labelOf,
  todayISO,
  type WorkNoteType,
} from '../lib/constants'
import {
  openWorkFollowupCount,
  workNoteDisplayTitle,
  workNoteRelatedSummary,
  workNoteSnippet,
} from '../lib/workNoteFormat'
import type { ClassRow, Student, WorkNoteRow, WorkNoteStatus } from '../lib/types'
import { useAuth } from '../context/AuthContext'

export function WorkNotesPage({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notes, setNotes] = useState<WorkNoteRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [noteType, setNoteType] = useState('')
  const [status, setStatus] = useState('')
  const [importantOnly, setImportantOnly] = useState(false)
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '')
  const [studentId, setStudentId] = useState(searchParams.get('studentId') ?? '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<WorkNoteRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WorkNoteRow | null>(null)

  const loadMeta = useCallback(async () => {
    const term = await fetchCurrentTerm()
    const [cls, sts] = await Promise.all([
      fetchClasses(term?.id),
      fetchStudents(),
    ])
    setClasses(
      [...cls].sort((a, b) =>
        formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
      ),
    )
    setStudents(sts.filter((s) => s.enrollment_status === 'active'))
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchWorkNotes({
        noteType: noteType || undefined,
        status: status || undefined,
        importantOnly: importantOnly || undefined,
        classId: classId || undefined,
        studentId: studentId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      setNotes(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [noteType, status, importantOnly, classId, studentId, dateFrom, dateTo, search])

  useEffect(() => {
    void loadMeta().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [loadMeta, refreshKey])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  async function refreshSelected(id: string) {
    const full = await fetchWorkNote(id)
    setSelected(full)
    await reload()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Work Note</h1>
          <p className="muted" style={{ margin: 0 }}>
            교무회의·결재·전달사항 (학생 Record와 별도)
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          + New Work Note
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="filters row wrap">
          <label>
            Type
            <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="">전체</option>
              {WORK_NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">전체</option>
              {WORK_NOTE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={importantOnly}
              onChange={(e) => setImportantOnly(e.target.checked)}
            />
            Important only
          </label>
          <label>
            Class
            <select
              value={classId}
              onChange={(e) => {
                const v = e.target.value
                setClassId(v)
                const next = new URLSearchParams(searchParams)
                if (v) next.set('classId', v)
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
            Student
            <select
              value={studentId}
              onChange={(e) => {
                const v = e.target.value
                setStudentId(v)
                const next = new URLSearchParams(searchParams)
                if (v) next.set('studentId', v)
                else next.delete('studentId')
                setSearchParams(next, { replace: true })
              }}
            >
              <option value="">전체</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.korean_name}
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
              placeholder="제목 / 본문 / 출처"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </section>

      {loading && <p className="muted">Loading…</p>}

      {!loading && notes.length === 0 && (
        <section className="card empty-state">
          <h2>Work Note가 없습니다.</h2>
          <p className="muted">+ New Work Note로 회의·결재 전달사항을 남기세요.</p>
        </section>
      )}

      <div className="message-list">
        {notes.map((n) => {
          const openFu = openWorkFollowupCount(n)
          return (
            <button
              key={n.id}
              type="button"
              className="card message-card clickable-row"
              onClick={() => setSelected(n)}
            >
              <div className="row wrap gap">
                <span className="muted small">{n.note_date}</span>
                <span className="badge">{labelOf(WORK_NOTE_TYPES, n.note_type)}</span>
                {n.is_important && <span className="star">★</span>}
                <span className="badge badge-mgmt">{labelOf(WORK_NOTE_STATUSES, n.status)}</span>
                {openFu > 0 && <span className="badge">Follow-up {openFu}</span>}
              </div>
              {n.source && <p className="muted small" style={{ margin: '0.25rem 0 0' }}>{n.source}</p>}
              <h2 className="message-card-title">{workNoteDisplayTitle(n)}</h2>
              <p className="muted small">관련: {workNoteRelatedSummary(n)}</p>
              <p className="message-snippet">{workNoteSnippet(n.content)}</p>
            </button>
          )
        })}
      </div>

      {selected && (
        <WorkNoteDetailModal
          note={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
            setShowForm(true)
            setSelected(null)
          }}
          onChanged={() => void refreshSelected(selected.id)}
        />
      )}

      {showForm && (
        <WorkNoteFormModal
          initial={editing}
          classes={classes}
          students={students}
          userId={user?.id ?? null}
          defaultClassId={classId || undefined}
          defaultStudentId={studentId || undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setShowForm(false)
            setEditing(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}

function WorkNoteDetailModal({
  note,
  onClose,
  onEdit,
  onChanged,
}: {
  note: WorkNoteRow
  onClose: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  const [addingFu, setAddingFu] = useState(false)
  const [fuNote, setFuNote] = useState('')
  const [fuDue, setFuDue] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveFu(e: FormEvent) {
    e.preventDefault()
    if (!fuNote.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addWorkFollowup({
        work_note_id: note.id,
        due_date: fuDue || null,
        note: fuNote.trim(),
      })
      setFuNote('')
      setAddingFu(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal message-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <div>
            <p className="muted small" style={{ margin: 0 }}>{note.note_date}</p>
            <h2 style={{ margin: '0.25rem 0' }}>{workNoteDisplayTitle(note)}</h2>
            <div className="row wrap gap">
              <span className="badge">{labelOf(WORK_NOTE_TYPES, note.note_type)}</span>
              {note.is_important && <span className="star">★ Important</span>}
              <span className="badge">{labelOf(WORK_NOTE_STATUSES, note.status)}</span>
            </div>
            {note.source && <p className="muted small">출처: {note.source}</p>}
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <p className="muted small">관련: {workNoteRelatedSummary(note)}</p>
        <pre className="message-body">{note.content}</pre>

        <section className="stack nested">
          <div className="page-header">
            <h3>Work Follow-ups</h3>
            <button type="button" className="btn small" onClick={() => setAddingFu((v) => !v)}>
              + Follow-up
            </button>
          </div>
          {addingFu && (
            <form className="stack" onSubmit={(e) => void saveFu(e)}>
              <label>
                Due date
                <input type="date" value={fuDue} onChange={(e) => setFuDue(e.target.value)} />
              </label>
              <label>
                Note *
                <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} required />
              </label>
              <button type="submit" className="btn primary small" disabled={busy}>Save</button>
            </form>
          )}
          <ul className="nested-list">
            {(note.work_followups ?? []).map((f) => (
              <li key={f.id}>
                <span className={`badge ${f.status === 'open' ? 'badge-overdue' : ''}`}>
                  {f.status === 'open' ? 'OPEN' : 'DONE'}
                </span>{' '}
                {f.due_date ? formatShortDate(f.due_date) : '—'} · {f.note}
                {f.status === 'open' && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      void completeWorkFollowup(f.id).then(onChanged)
                    }
                  >
                    Mark Done
                  </button>
                )}
              </li>
            ))}
            {(note.work_followups ?? []).length === 0 && (
              <li className="muted">Follow-up 없음 (참고용 메모)</li>
            )}
          </ul>
        </section>

        {error && <p className="error">{error}</p>}
        <div className="row wrap gap end">
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void toggleWorkNoteImportant(note.id, !note.is_important).then(onChanged)
            }
          >
            {note.is_important ? '★ Important' : '☆ Mark Important'}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void setWorkNoteStatus(
                note.id,
                note.status === 'open' ? 'done' : 'open',
              ).then(onChanged)
            }
          >
            {note.status === 'open' ? '완료로 표시' : '다시 열기'}
          </button>
          <button type="button" className="btn" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  )
}

function WorkNoteFormModal({
  initial,
  classes,
  students,
  userId,
  defaultClassId,
  defaultStudentId,
  onClose,
  onSaved,
}: {
  initial: WorkNoteRow | null
  classes: ClassRow[]
  students: Student[]
  userId: string | null
  defaultClassId?: string
  defaultStudentId?: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [noteDate, setNoteDate] = useState(initial?.note_date ?? todayISO())
  const [noteType, setNoteType] = useState<WorkNoteType>(initial?.note_type ?? 'general')
  const [source, setSource] = useState(initial?.source ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [important, setImportant] = useState(initial?.is_important ?? false)
  const [status, setStatus] = useState<WorkNoteStatus>(initial?.status ?? 'open')
  const [classIds, setClassIds] = useState<string[]>(
    initial?.work_note_classes?.map((c) => c.class_id) ??
      (defaultClassId ? [defaultClassId] : []),
  )
  const [studentIds, setStudentIds] = useState<string[]>(
    initial?.work_note_students?.map((s) => s.student_id) ??
      (defaultStudentId ? [defaultStudentId] : []),
  )
  const [addFu, setAddFu] = useState(false)
  const [fuDue, setFuDue] = useState(todayISO())
  const [fuNote, setFuNote] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [studentClassFilter, setStudentClassFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (studentClassFilter && s.class_id !== studentClassFilter) return false
      if (studentQ) {
        const hay = `${s.korean_name} ${s.english_name ?? ''}`.toLowerCase()
        if (!hay.includes(studentQ.toLowerCase())) return false
      }
      return true
    })
  }, [students, studentQ, studentClassFilter])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('내용을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (initial) {
        await updateWorkNote(initial.id, {
          note_date: noteDate,
          note_type: noteType,
          source,
          title,
          content,
          is_important: important,
          status,
          studentIds,
          classIds,
        })
      } else {
        await createWorkNote({
          note_date: noteDate,
          note_type: noteType,
          source,
          title,
          content,
          is_important: important,
          status,
          created_by: userId,
          studentIds,
          classIds,
          followups:
            addFu && fuNote.trim()
              ? [{ due_date: fuDue || null, note: fuNote.trim() }]
              : [],
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
        <h2>{initial ? 'Edit Work Note' : 'New Work Note'}</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="row wrap">
            <label>
              Date
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
            </label>
            <label>
              Type *
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as WorkNoteType)}
                required
              >
                {WORK_NOTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Source
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="예: 부원장님, 교무회의"
            />
          </label>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Content *
            <textarea
              className="message-textarea"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </label>
          <div className="row wrap gap">
            <label className="inline">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
              />
              Important
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkNoteStatus)}
              >
                {WORK_NOTE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="stack">
            <legend>Related Classes</legend>
            <div className="chip-row target-pick">
              {classes.map((c) => {
                const on = classIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    onClick={() =>
                      setClassIds((prev) =>
                        on ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                      )
                    }
                  >
                    {formatClassDisplay(c)}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="stack">
            <legend>Related Students</legend>
            <div className="row wrap">
              <input
                placeholder="학생 검색"
                value={studentQ}
                onChange={(e) => setStudentQ(e.target.value)}
              />
              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
              >
                <option value="">반 필터</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{formatClassDisplay(c)}</option>
                ))}
              </select>
            </div>
            <div className="chip-row target-pick student-pick">
              {filteredStudents.slice(0, 40).map((s) => {
                const on = studentIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    onClick={() =>
                      setStudentIds((prev) =>
                        on ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                      )
                    }
                  >
                    {s.korean_name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {!initial && (
            <fieldset className="stack">
              <legend>Follow-up (선택)</legend>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={addFu}
                  onChange={(e) => setAddFu(e.target.checked)}
                />
                후속 확인 항목 추가
              </label>
              {addFu && (
                <>
                  <label>
                    Due date
                    <input type="date" value={fuDue} onChange={(e) => setFuDue(e.target.value)} />
                  </label>
                  <label>
                    Note
                    <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} />
                  </label>
                </>
              )}
            </fieldset>
          )}

          {error && <p className="error">{error}</p>}
          <div className="row end">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
