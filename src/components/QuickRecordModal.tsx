import { FormEvent, useEffect, useState } from 'react'
import {
  CONTACT_METHODS,
  RECORD_TYPES,
  TAG_CATEGORY_LABELS,
  labelOf,
  todayISO,
} from '../lib/constants'
import {
  addFollowup,
  createQuickRecord,
  fetchStudents,
  fetchTags,
  linkRecordToCase,
  pinRecordAsFocus,
} from '../lib/api'
import type { ContactMethod, RecordType, StampStatus, Student, Tag } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { LinkCasePanel } from './LinkCasePanel'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultStudentId?: string
  lockStudent?: boolean
  linkCaseId?: string
}

interface FollowupDraft {
  due_date: string
  note: string
}

type Phase = 'form' | 'after'

export function QuickRecordModal({
  open,
  onClose,
  onSaved,
  defaultStudentId,
  lockStudent = false,
  linkCaseId,
}: Props) {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [recordDate, setRecordDate] = useState(todayISO())
  const [recordType, setRecordType] = useState<RecordType>('observation')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [important, setImportant] = useState(false)
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone')
  const [stampAmount, setStampAmount] = useState(1)
  const [stampStatus, setStampStatus] = useState<StampStatus>('pending')
  const [includeFollowup, setIncludeFollowup] = useState(false)
  const [followups, setFollowups] = useState<FollowupDraft[]>([
    { due_date: todayISO(), note: '' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<Phase>('form')
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [savedStudentId, setSavedStudentId] = useState('')
  const [savedType, setSavedType] = useState<RecordType>('observation')
  const [savedContent, setSavedContent] = useState('')
  const [savedDate, setSavedDate] = useState(todayISO())
  const [afterAction, setAfterAction] = useState<'none' | 'followup' | 'case'>('none')
  const [fuDue, setFuDue] = useState(todayISO())
  const [fuNote, setFuNote] = useState('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const [s, t] = await Promise.all([fetchStudents(), fetchTags()])
        setStudents(
          lockStudent && defaultStudentId
            ? s
            : s.filter((x) => x.enrollment_status === 'active'),
        )
        setTags(t)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    setStudentId(defaultStudentId ?? '')
    setRecordDate(todayISO())
    setRecordType('observation')
    setTagIds([])
    setContent('')
    setImportant(false)
    setIncludeFollowup(false)
    setFollowups([{ due_date: todayISO(), note: '' }])
    setError(null)
    setPhase('form')
    setSavedRecordId(null)
    setAfterAction('none')
    setStatusMsg(null)
  }, [open, defaultStudentId, lockStudent])

  if (!open) return null

  const lockedStudent = students.find((s) => s.id === studentId)
  const lockedLabel = lockedStudent
    ? `${lockedStudent.korean_name}${lockedStudent.english_name ? ` / ${lockedStudent.english_name}` : ''}`
    : '현재 학생'

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function finish() {
    onSaved()
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!studentId || !content.trim()) {
      setError('학생과 내용을 입력하세요.')
      return
    }
    if (recordType === 'stamp' && (!stampAmount || stampAmount < 1)) {
      setError('스탬프 수량은 1 이상이어야 합니다.')
      return
    }
    setSaving(true)
    try {
      const recordId = await createQuickRecord({
        student_id: studentId,
        record_date: recordDate,
        record_type: recordType,
        content: content.trim(),
        is_important: important,
        tag_ids: tagIds,
        contact_method: recordType === 'parent_contact' ? contactMethod : null,
        stamp_amount: recordType === 'stamp' ? stampAmount : null,
        stamp_status: recordType === 'stamp' ? stampStatus : null,
        followups: includeFollowup
          ? followups.filter((f) => f.note.trim()).map((f) => ({
              due_date: f.due_date || null,
              note: f.note,
            }))
          : [],
        created_by: user?.id ?? null,
      })
      if (linkCaseId) {
        await linkRecordToCase(linkCaseId, recordId)
        onSaved()
        onClose()
        return
      }
      setSavedRecordId(recordId)
      setSavedStudentId(studentId)
      setSavedType(recordType)
      setSavedContent(content.trim())
      setSavedDate(recordDate)
      setPhase('after')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function pinFocus() {
    if (!savedRecordId) return
    setSaving(true)
    setStatusMsg(null)
    try {
      await pinRecordAsFocus({
        student_id: savedStudentId,
        record_date: savedDate,
        record_type: savedType,
        content: savedContent,
        typeLabel: labelOf(RECORD_TYPES, savedType),
      })
      setStatusMsg('현재 Focus로 고정했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Focus 실패')
    } finally {
      setSaving(false)
    }
  }

  async function saveAfterFollowup(e: FormEvent) {
    e.preventDefault()
    if (!savedRecordId || !fuNote.trim()) return
    setSaving(true)
    try {
      await addFollowup({
        record_id: savedRecordId,
        due_date: fuDue || null,
        note: fuNote,
      })
      setStatusMsg('Follow-up을 추가했습니다.')
      setAfterAction('none')
      setFuNote('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Follow-up 실패')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'after' && savedRecordId) {
    return (
      <div className="modal-backdrop" role="presentation" onClick={finish}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>기록이 저장되었습니다</h2>
          <p className="muted">이 기록으로 더 할 일이 있나요?</p>
          {statusMsg && <p className="toast-inline">{statusMsg}</p>}
          {error && <p className="error">{error}</p>}

          {afterAction === 'none' && (
            <div className="stack link-first-actions">
              <button
                type="button"
                className="btn"
                title="Follow-up 생성 — 다음에 다시 확인할 일"
                onClick={() => setAfterAction('followup')}
              >
                다시 확인
              </button>
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={() => void pinFocus()}
              >
                Focus로 고정
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setAfterAction('case')}
              >
                Case에 연결
              </button>
              <button type="button" className="btn primary" onClick={finish}>
                끝
              </button>
            </div>
          )}

          {afterAction === 'followup' && (
            <form className="stack" onSubmit={(e) => void saveAfterFollowup(e)}>
              <label>
                Due
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
                  onClick={() => setAfterAction('none')}
                >
                  뒤로
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  Save
                </button>
              </div>
            </form>
          )}

          {afterAction === 'case' && (
            <LinkCasePanel
              studentId={savedStudentId}
              recordId={savedRecordId}
              onCancel={() => setAfterAction('none')}
              onDone={async () => {
                setStatusMsg('Case에 연결했습니다.')
                setAfterAction('none')
                onSaved()
              }}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-sticky-actions"
        role="dialog"
        aria-labelledby="qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="qr-title">Quick Record</h2>
        <form className="stack modal-scroll-body" onSubmit={(e) => void onSubmit(e)}>
          {lockStudent ? (
            <label>
              학생
              <input type="text" value={lockedLabel} readOnly className="readonly-input" />
            </label>
          ) : (
            <label>
              학생 *
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">선택</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.korean_name}
                    {s.english_name ? ` / ${s.english_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            날짜 *
            <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
          </label>
          <label>
            기록 종류 *
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as RecordType)}
            >
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>태그</legend>
            {TAG_CATEGORY_LABELS.map((cat) => {
              const group = tags.filter((t) => t.category === cat.value)
              if (group.length === 0) return null
              return (
                <div key={cat.value} className="tag-group">
                  <div className="tag-group-label muted small">{cat.label}</div>
                  <div className="chip-row">
                    {group.map((t) => (
                      <label
                        key={t.id}
                        className={`chip ${tagIds.includes(t.id) ? 'on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={tagIds.includes(t.id)}
                          onChange={() => toggleTag(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            {tags.some((t) => !TAG_CATEGORY_LABELS.some((c) => c.value === t.category)) && (
              <div className="tag-group">
                <div className="tag-group-label muted small">Other</div>
                <div className="chip-row">
                  {tags
                    .filter(
                      (t) => !TAG_CATEGORY_LABELS.some((c) => c.value === t.category),
                    )
                    .map((t) => (
                      <label
                        key={t.id}
                        className={`chip ${tagIds.includes(t.id) ? 'on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={tagIds.includes(t.id)}
                          onChange={() => toggleTag(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                </div>
              </div>
            )}
          </fieldset>
          <label>
            {recordType === 'stamp' ? '사유 (content) *' : '내용 *'}
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
            />
            중요 기록
          </label>

          {recordType === 'parent_contact' && (
            <label>
              연락 방식
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {recordType === 'stamp' && (
            <div className="row">
              <label>
                수량 *
                <input
                  type="number"
                  min={1}
                  value={stampAmount}
                  onChange={(e) => setStampAmount(Number(e.target.value))}
                />
              </label>
              <label>
                지급 상태
                <select
                  value={stampStatus}
                  onChange={(e) => setStampStatus(e.target.value as StampStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="given">Given</option>
                </select>
              </label>
            </div>
          )}

          <label className="inline">
            <input
              type="checkbox"
              checked={includeFollowup}
              onChange={(e) => setIncludeFollowup(e.target.checked)}
            />
            Follow-up 함께 추가
          </label>
          {includeFollowup && (
            <div className="stack nested">
              {followups.map((f, idx) => (
                <div key={idx} className="row">
                  <label>
                    Due
                    <input
                      type="date"
                      value={f.due_date}
                      onChange={(e) => {
                        const next = [...followups]
                        next[idx] = { ...next[idx], due_date: e.target.value }
                        setFollowups(next)
                      }}
                    />
                  </label>
                  <label className="grow">
                    Note
                    <input
                      value={f.note}
                      onChange={(e) => {
                        const next = [...followups]
                        next[idx] = { ...next[idx], note: e.target.value }
                        setFollowups(next)
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <div className="modal-action-footer">
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
