import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  fetchAbcByRecordId,
  fetchContextTags,
  fetchRecordContextTags,
  setRecordContextTags,
  upsertAbcObservation,
} from '../lib/api'
import type { AbcObservation, ContextTag, RecordRow } from '../lib/types'
import { useAuth } from '../context/AuthContext'

type Props = {
  record: RecordRow
  caseId?: string | null
  onChanged?: () => Promise<void> | void
}

export function AbcContextSection({ record, caseId, onChanged }: Props) {
  const { user } = useAuth()
  const [abc, setAbc] = useState<AbcObservation | null>(null)
  const [contextTags, setContextTags] = useState<ContextTag[]>([])
  const [allTags, setAllTags] = useState<ContextTag[]>([])
  const [editingAbc, setEditingAbc] = useState(false)
  const [editingContext, setEditingContext] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isObservation = record.record_type === 'observation'

  const reload = useCallback(async () => {
    if (!isObservation) return
    setError(null)
    try {
      const [abcRow, tags, selected] = await Promise.all([
        fetchAbcByRecordId(record.id),
        fetchContextTags(true),
        fetchRecordContextTags(record.id),
      ])
      setAbc(abcRow)
      setAllTags(tags)
      setContextTags(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }, [isObservation, record.id])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!isObservation) return null

  return (
    <section className="abc-context-section">
      <div className="page-header" style={{ marginBottom: 'var(--space-2)' }}>
        <div>
          <h3 style={{ margin: 0 }}>Context · 상황 맥락</h3>
          <p className="muted small" style={{ margin: 0 }}>
            언제/어떤 상황에서 발생했는지 (일반 Tag와 별개)
          </p>
        </div>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setEditingContext((v) => !v)}
        >
          {editingContext ? '닫기' : 'Context 편집'}
        </button>
      </div>

      <div className="chip-row">
        {contextTags.length === 0 && <span className="muted small">Context 없음</span>}
        {contextTags.map((t) => (
          <span key={t.id} className="chip on context-chip">
            {t.label}
          </span>
        ))}
      </div>

      {editingContext && (
        <ContextTagPicker
          allTags={allTags}
          selectedIds={new Set(contextTags.map((t) => t.id))}
          onSave={async (ids) => {
            await setRecordContextTags(record.id, ids)
            setEditingContext(false)
            await reload()
            await onChanged?.()
          }}
          onCancel={() => setEditingContext(false)}
        />
      )}

      <div className="page-header" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <h3 style={{ margin: 0 }}>ABC Observation</h3>
          <p className="muted small" style={{ margin: 0 }}>
            선택 사항 · Observation 본문과 별도
          </p>
        </div>
        <button
          type="button"
          className="btn small"
          onClick={() => setEditingAbc((v) => !v)}
        >
          {editingAbc ? '닫기' : abc ? 'Edit ABC' : '+ ABC 기록'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {!editingAbc && abc && (
        <div className="abc-display">
          {abc.antecedent && (
            <div>
              <h4 className="dt-subhead">Antecedent</h4>
              <pre className="dt-quote">{abc.antecedent}</pre>
            </div>
          )}
          <div>
            <h4 className="dt-subhead">Behavior</h4>
            <pre className="dt-quote">{abc.behavior}</pre>
          </div>
          {abc.consequence && (
            <div>
              <h4 className="dt-subhead">Consequence</h4>
              <pre className="dt-quote">{abc.consequence}</pre>
            </div>
          )}
          {abc.teacher_response && (
            <div>
              <h4 className="dt-subhead">Teacher Response</h4>
              <pre className="dt-quote">{abc.teacher_response}</pre>
            </div>
          )}
          {abc.student_response && (
            <div>
              <h4 className="dt-subhead">Student Response (사건 직후)</h4>
              <pre className="dt-quote">{abc.student_response}</pre>
            </div>
          )}
        </div>
      )}

      {!editingAbc && !abc && (
        <p className="muted small">
          깊게 볼 관찰만 ABC로 구조화하세요. Quick Record 흐름은 그대로입니다.
        </p>
      )}

      {editingAbc && (
        <AbcForm
          initial={abc}
          allTags={allTags}
          selectedContextIds={contextTags.map((t) => t.id)}
          onCancel={() => setEditingAbc(false)}
          onSave={async (fields, tagIds) => {
            await upsertAbcObservation({
              record_id: record.id,
              student_id: record.student_id,
              case_id: caseId ?? null,
              created_by: user?.id ?? null,
              context_tag_ids: tagIds,
              ...fields,
            })
            setEditingAbc(false)
            await reload()
            await onChanged?.()
          }}
        />
      )}
    </section>
  )
}

function ContextTagPicker({
  allTags,
  selectedIds,
  onSave,
  onCancel,
}: {
  allTags: ContextTag[]
  selectedIds: Set<string>
  onSave: (ids: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selectedIds))
  const [busy, setBusy] = useState(false)

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="stack nested" style={{ marginTop: 'var(--space-3)' }}>
      <div className="chip-row">
        {allTags.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${picked.has(t.id) ? 'on' : ''}`}
            onClick={() => toggle(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onSave([...picked]).finally(() => setBusy(false))
          }}
        >
          Save Context
        </button>
      </div>
    </div>
  )
}

function AbcForm({
  initial,
  allTags,
  selectedContextIds,
  onSave,
  onCancel,
}: {
  initial: AbcObservation | null
  allTags: ContextTag[]
  selectedContextIds: string[]
  onSave: (
    fields: {
      antecedent: string | null
      behavior: string
      consequence: string | null
      teacher_response: string | null
      student_response: string | null
    },
    contextTagIds: string[],
  ) => Promise<void>
  onCancel: () => void
}) {
  const [antecedent, setAntecedent] = useState(initial?.antecedent ?? '')
  const [behavior, setBehavior] = useState(initial?.behavior ?? '')
  const [consequence, setConsequence] = useState(initial?.consequence ?? '')
  const [teacherResponse, setTeacherResponse] = useState(initial?.teacher_response ?? '')
  const [studentResponse, setStudentResponse] = useState(initial?.student_response ?? '')
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selectedContextIds))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!behavior.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSave(
        {
          antecedent: antecedent.trim() || null,
          behavior: behavior.trim(),
          consequence: consequence.trim() || null,
          teacher_response: teacherResponse.trim() || null,
          student_response: studentResponse.trim() || null,
        },
        [...picked],
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack nested abc-form" onSubmit={(e) => void submit(e)}>
      <p className="dt-disclaimer">
        ABC에는 가능한 한 관찰 가능한 사건과 행동을 기록합니다. 원인에 대한 해석은 Working
        Hypothesis(작업 가설)에 기록하세요.
      </p>
      <label>
        Antecedent
        <textarea
          rows={2}
          value={antecedent}
          onChange={(e) => setAntecedent(e.target.value)}
          placeholder="행동 직전에 무엇이 있었는가?"
        />
      </label>
      <label>
        Behavior *
        <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
          관찰 가능한 행동만 — 해석(“불안해서”, “ADHD라서”)은 여기 적지 마세요.
        </span>
        <textarea
          rows={3}
          value={behavior}
          onChange={(e) => setBehavior(e.target.value)}
          required
        />
      </label>
      <label>
        Consequence
        <textarea
          rows={2}
          value={consequence}
          onChange={(e) => setConsequence(e.target.value)}
          placeholder="행동 이후 환경에서 무엇이 일어났는가?"
        />
      </label>
      <label>
        Teacher Response
        <textarea
          rows={2}
          value={teacherResponse}
          onChange={(e) => setTeacherResponse(e.target.value)}
        />
      </label>
      <label>
        Student Response (사건 직후)
        <textarea
          rows={2}
          value={studentResponse}
          onChange={(e) => setStudentResponse(e.target.value)}
        />
      </label>
      <div>
        <h4 className="dt-subhead">Context Tags</h4>
        <div className="chip-row">
          {allTags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip ${picked.has(t.id) ? 'on' : ''}`}
              onClick={() => toggle(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          Save ABC
        </button>
      </div>
    </form>
  )
}

export function hasAbcOnRecord(
  abc:
    | { id: string }[]
    | { id: string }
    | null
    | undefined,
): boolean {
  if (!abc) return false
  if (Array.isArray(abc)) return abc.length > 0
  return Boolean(abc.id)
}
