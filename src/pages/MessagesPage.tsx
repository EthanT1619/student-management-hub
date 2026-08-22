import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createMessage,
  fetchClasses,
  fetchMessages,
  fetchStudents,
  fetchTerms,
  setMessageTemplateFlag,
  updateMessage,
  type MessageTargetInput,
} from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  MESSAGE_PURPOSES,
  labelOf,
  todayISO,
  type MessagePurpose,
} from '../lib/constants'
import {
  messageDisplayTitle,
  messageSnippet,
  messageTargetSummary,
} from '../lib/messageFormat'
import type { ClassRow, MessageRow, Student, TermRow } from '../lib/types'
import { useAuth } from '../context/AuthContext'

type TabMode = 'archive' | 'templates'

export function MessagesPage({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialClassId = searchParams.get('classId') ?? ''
  const initialStudentId = searchParams.get('studentId') ?? ''

  const [tab, setTab] = useState<TabMode>('archive')
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [terms, setTerms] = useState<TermRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [purpose, setPurpose] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState(initialClassId)
  const [studentId, setStudentId] = useState(initialStudentId)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MessageRow | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate' | null>(null)
  const [formSeed, setFormSeed] = useState<Partial<MessageFormValues> | null>(null)

  const loadMeta = useCallback(async () => {
    const [t, s] = await Promise.all([fetchTerms(), fetchStudents()])
    setTerms(t)
    setStudents(s.filter((x) => x.enrollment_status === 'active'))
    const current = t.find((x) => x.is_current) ?? t[0] ?? null
    const tid = termId || current?.id || ''
    if (!termId && tid) setTermId(tid)
    const cls = tid ? await fetchClasses(tid) : await fetchClasses()
    setClasses(
      [...cls].sort((a, b) =>
        formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
      ),
    )
  }, [termId])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchMessages({
        isTemplate: tab === 'templates',
        purpose: purpose || undefined,
        classId: classId || undefined,
        studentId: studentId || undefined,
        termId: termId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      setMessages(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [tab, purpose, classId, studentId, termId, dateFrom, dateTo, search])

  useEffect(() => {
    void loadMeta().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [loadMeta, refreshKey])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  async function onTermChange(next: string) {
    setTermId(next)
    setClassId('')
    const cls = next ? await fetchClasses(next) : []
    setClasses(
      [...cls].sort((a, b) =>
        formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
      ),
    )
  }

  function openCreate(seed?: Partial<MessageFormValues>) {
    setFormSeed(seed ?? null)
    setFormMode('create')
    setSelected(null)
  }

  function openDuplicate(m: MessageRow) {
    setFormSeed({
      purpose: m.purpose,
      title: m.title ?? '',
      content: m.content,
      notes: m.notes ?? '',
      is_template: false,
      message_date: todayISO(),
      classIds: [],
      studentIds: [],
      includeAll: false,
      copyTargetsHint: true,
    })
    setFormMode('duplicate')
    setSelected(null)
  }

  function openEdit(m: MessageRow) {
    const targets = m.message_targets ?? []
    setFormSeed({
      purpose: m.purpose,
      title: m.title ?? '',
      content: m.content,
      notes: m.notes ?? '',
      is_template: m.is_template,
      message_date: m.message_date,
      classIds: targets.filter((t) => t.target_type === 'class' && t.class_id).map((t) => t.class_id!),
      studentIds: targets
        .filter((t) => t.target_type === 'student' && t.student_id)
        .map((t) => t.student_id!),
      includeAll: targets.some((t) => t.target_type === 'all'),
    })
    setFormMode('edit')
    setSelected(m)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <p className="muted" style={{ margin: 0 }}>
            안내문자·양식 아카이브 (발송 기능 없음)
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            openCreate({
              message_date: todayISO(),
              purpose: 'general_notice',
              is_template: tab === 'templates',
              classIds: classId ? [classId] : [],
              studentIds: studentId ? [studentId] : [],
            })
          }
        >
          + New Message
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist">
        <button
          type="button"
          className={`btn ${tab === 'archive' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('archive')}
        >
          Archive
        </button>
        <button
          type="button"
          className={`btn ${tab === 'templates' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('templates')}
        >
          Templates
        </button>
      </div>

      <section className="card">
        <div className="filters row wrap">
          <label>
            Purpose
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">전체</option>
              {MESSAGE_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {tab === 'archive' && (
            <>
              <label>
                Term
                <select value={termId} onChange={(e) => void onTermChange(e.target.value)}>
                  <option value="">전체</option>
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
                      {s.english_name ? ` / ${s.english_name}` : ''}
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
            </>
          )}
          <label className="grow">
            Search
            <input
              placeholder="제목 / 본문 / 메모"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </section>

      {loading && <p className="muted">Loading…</p>}

      {!loading && messages.length === 0 && (
        <section className="card empty-state">
          <h2>{tab === 'templates' ? '템플릿이 없습니다.' : '저장된 문자가 없습니다.'}</h2>
          <p className="muted">+ New Message로 첫 항목을 추가하세요.</p>
        </section>
      )}

      <div className="message-list">
        {messages.map((m) => (
          <button
            key={m.id}
            type="button"
            className="card message-card clickable-row"
            onClick={() => setSelected(m)}
          >
            <div className="row wrap gap" style={{ justifyContent: 'space-between' }}>
              <div className="row wrap gap">
                {tab === 'archive' && (
                  <span className="muted small">{m.message_date}</span>
                )}
                <span className="badge">{labelOf(MESSAGE_PURPOSES, m.purpose)}</span>
              </div>
              {m.is_template && <span className="badge">Template</span>}
            </div>
            <h2 className="message-card-title">{messageDisplayTitle(m)}</h2>
            {tab === 'archive' && (
              <p className="muted small" style={{ margin: '0.35rem 0' }}>
                대상: {messageTargetSummary(m.message_targets)}
              </p>
            )}
            <p className="message-snippet">{messageSnippet(m.content)}</p>
          </button>
        ))}
      </div>

      {selected && !formMode && (
        <MessageDetailModal
          message={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onDuplicate={() => openDuplicate(selected)}
          onUseTemplate={() =>
            openCreate({
              purpose: selected.purpose,
              title: selected.title ?? '',
              content: selected.content,
              notes: selected.notes ?? '',
              message_date: todayISO(),
              is_template: false,
              classIds: [],
              studentIds: [],
              includeAll: false,
            })
          }
          onToggleTemplate={async () => {
            await setMessageTemplateFlag(selected.id, !selected.is_template)
            setSelected(null)
            await reload()
          }}
        />
      )}

      {formMode && (
        <MessageFormModal
          mode={formMode}
          editId={formMode === 'edit' ? selected?.id : undefined}
          seed={formSeed}
          classes={classes}
          students={students}
          terms={terms}
          termId={termId}
          onTermClasses={async (tid) => {
            const cls = tid ? await fetchClasses(tid) : []
            return [...cls].sort((a, b) =>
              formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
            )
          }}
          userId={user?.id ?? null}
          onClose={() => {
            setFormMode(null)
            setFormSeed(null)
          }}
          onSaved={async () => {
            setFormMode(null)
            setFormSeed(null)
            setSelected(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}

interface MessageFormValues {
  message_date: string
  purpose: MessagePurpose
  title: string
  content: string
  notes: string
  is_template: boolean
  includeAll: boolean
  classIds: string[]
  studentIds: string[]
  copyTargetsHint?: boolean
}

function MessageDetailModal({
  message,
  onClose,
  onEdit,
  onDuplicate,
  onUseTemplate,
  onToggleTemplate,
}: {
  message: MessageRow
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onUseTemplate: () => void
  onToggleTemplate: () => Promise<void>
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal message-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="page-header">
          <div>
            <p className="muted small" style={{ margin: 0 }}>
              {message.is_template ? 'Template' : message.message_date}
            </p>
            <h2 style={{ margin: '0.25rem 0' }}>{messageDisplayTitle(message)}</h2>
            <span className="badge">{labelOf(MESSAGE_PURPOSES, message.purpose)}</span>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {!message.is_template && (
          <p className="muted small">대상: {messageTargetSummary(message.message_targets)}</p>
        )}

        <pre className="message-body">{message.content}</pre>

        {message.notes && (
          <p className="muted">
            <strong>Notes:</strong> {message.notes}
          </p>
        )}

        <div className="row wrap gap end">
          {message.is_template ? (
            <button type="button" className="btn primary" onClick={onUseTemplate}>
              Use Template
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={onDuplicate}>
              Duplicate as New
            </button>
          )}
          <button type="button" className="btn" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void onToggleTemplate()}
          >
            {message.is_template ? 'Template 해제 → Archive' : 'Save as Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageFormModal({
  mode,
  editId,
  seed,
  classes: initialClasses,
  students,
  terms,
  termId: initialTermId,
  onTermClasses,
  userId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit' | 'duplicate'
  editId?: string
  seed: Partial<MessageFormValues> | null
  classes: ClassRow[]
  students: Student[]
  terms: TermRow[]
  termId: string
  onTermClasses: (termId: string) => Promise<ClassRow[]>
  userId: string | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [messageDate, setMessageDate] = useState(seed?.message_date ?? todayISO())
  const [purpose, setPurpose] = useState<MessagePurpose>(seed?.purpose ?? 'general_notice')
  const [title, setTitle] = useState(seed?.title ?? '')
  const [content, setContent] = useState(seed?.content ?? '')
  const [notes, setNotes] = useState(seed?.notes ?? '')
  const [isTemplate, setIsTemplate] = useState(seed?.is_template ?? false)
  const [includeAll, setIncludeAll] = useState(seed?.includeAll ?? false)
  const [classIds, setClassIds] = useState<string[]>(seed?.classIds ?? [])
  const [studentIds, setStudentIds] = useState<string[]>(seed?.studentIds ?? [])
  const [formTermId, setFormTermId] = useState(initialTermId)
  const [formClasses, setFormClasses] = useState(initialClasses)
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

  function buildTargets(): MessageTargetInput[] {
    if (isTemplate) return []
    if (includeAll) return [{ target_type: 'all' }]
    const targets: MessageTargetInput[] = [
      ...classIds.map((id) => ({ target_type: 'class' as const, class_id: id })),
      ...studentIds.map((id) => ({ target_type: 'student' as const, student_id: id })),
    ]
    return targets
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('본문을 입력하세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const targets = buildTargets()
      if (mode === 'edit' && editId) {
        await updateMessage(editId, {
          message_date: messageDate,
          purpose,
          title,
          content,
          notes,
          is_template: isTemplate,
          targets,
        })
      } else {
        await createMessage({
          message_date: messageDate,
          purpose,
          title,
          content,
          notes,
          is_template: isTemplate,
          created_by: userId,
          targets,
        })
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const heading =
    mode === 'edit' ? 'Edit Message' : mode === 'duplicate' ? 'Duplicate as New' : 'New Message'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal message-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{heading}</h2>
        {seed?.copyTargetsHint && (
          <p className="muted small">
            본문·Purpose는 복사되었습니다. 날짜는 오늘이며 Target은 새로 선택하세요.
          </p>
        )}
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label className="inline">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
            />
            Save as Template (Archive와 분리)
          </label>
          {!isTemplate && (
            <label>
              Date *
              <input
                type="date"
                value={messageDate}
                onChange={(e) => setMessageDate(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Purpose *
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as MessagePurpose)}
              required
            >
              {MESSAGE_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="짧은 식별용 제목"
            />
          </label>
          <label>
            Content *
            <textarea
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="message-textarea"
            />
          </label>
          <label>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {!isTemplate && (
            <fieldset className="stack">
              <legend>Targets</legend>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(e) => setIncludeAll(e.target.checked)}
                />
                전체
              </label>
              {!includeAll && (
                <>
                  <label>
                    Term (반 목록)
                    <select
                      value={formTermId}
                      onChange={(e) => {
                        const v = e.target.value
                        setFormTermId(v)
                        void onTermClasses(v).then(setFormClasses)
                      }}
                    >
                      {terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="muted small">Classes (복수 선택)</p>
                    <div className="chip-row target-pick">
                      {formClasses.map((c) => {
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
                  </div>
                  <div>
                    <p className="muted small">Students</p>
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
                        {formClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {formatClassDisplay(c)}
                          </option>
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
                            {s.accent_color && (
                              <span className={`accent-dot accent-${s.accent_color}`} />
                            )}
                            {s.korean_name}
                          </button>
                        )
                      })}
                    </div>
                    {filteredStudents.length > 40 && (
                      <p className="muted small">검색/반 필터로 더 좁혀 주세요.</p>
                    )}
                  </div>
                </>
              )}
            </fieldset>
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
