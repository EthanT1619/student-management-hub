import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createIntervention,
  createInterventionResponse,
  createStudentVoice,
  createWorkingHypothesis,
  fetchInterventions,
  fetchStudentRecords,
  fetchStudentVoice,
  fetchWorkingHypotheses,
  linkInterventionsToHypothesis,
  linkRecordsToHypothesis,
  updateWorkingHypothesis,
} from '../lib/api'
import {
  HYPOTHESIS_CONFIDENCE,
  HYPOTHESIS_STATUSES,
  INTERVENTION_TYPES,
  RECORD_TYPES,
  RESPONSE_TYPES,
  formatShortDate,
  labelOf,
  todayISO,
  type HypothesisConfidence,
  type HypothesisStatus,
  type InterventionType,
  type ResponseType,
} from '../lib/constants'
import type {
  Intervention,
  RecordRow,
  RecordType,
  StudentVoiceEntry,
  WorkingHypothesis,
} from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { hasAbcOnRecord } from './AbcContextSection'

export type DetailedTrackingContext = {
  studentId: string
  caseId?: string | null
  record?: RecordRow | null
}

export function DetailedTrackingPanel({
  ctx,
  defaultOpen = false,
}: {
  ctx: DetailedTrackingContext
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [voice, setVoice] = useState<StudentVoiceEntry[]>([])
  const [hypotheses, setHypotheses] = useState<WorkingHypothesis[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'voice' | 'hypothesis' | 'intervention' | null>(
    null,
  )

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [v, h, i] = await Promise.all([
        fetchStudentVoice(
          ctx.caseId
            ? { caseId: ctx.caseId }
            : ctx.record
              ? { recordId: ctx.record.id }
              : { studentId: ctx.studentId },
        ),
        fetchWorkingHypotheses(
          ctx.caseId
            ? { caseId: ctx.caseId }
            : { studentId: ctx.studentId },
        ),
        fetchInterventions(
          ctx.caseId
            ? { caseId: ctx.caseId }
            : ctx.record
              ? { recordId: ctx.record.id }
              : { studentId: ctx.studentId },
        ),
      ])

      if (ctx.record && !ctx.caseId) {
        setVoice(v)
        setHypotheses(
          h.filter((x) =>
            (x.hypothesis_records ?? []).some((hr) => hr.record_id === ctx.record!.id),
          ),
        )
        setInterventions(i)
      } else {
        setVoice(v)
        setHypotheses(h)
        setInterventions(i)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }, [ctx.caseId, ctx.record, ctx.studentId])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  // Lightweight counts even when collapsed (student/case level)
  useEffect(() => {
    if (open) return
    void Promise.all([
      fetchStudentVoice(
        ctx.caseId
          ? { caseId: ctx.caseId }
          : { studentId: ctx.studentId },
      ),
      fetchWorkingHypotheses(
        ctx.caseId
          ? { caseId: ctx.caseId }
          : { studentId: ctx.studentId },
      ),
      fetchInterventions(
        ctx.caseId
          ? { caseId: ctx.caseId }
          : { studentId: ctx.studentId },
      ),
    ])
      .then(([v, h, i]) => {
        setVoice(v)
        setHypotheses(h)
        setInterventions(i)
      })
      .catch(() => {
        /* keep collapsed quiet */
      })
  }, [ctx.caseId, ctx.studentId, open])

  const recordType = ctx.record?.record_type
  const canVoice =
    !ctx.record ||
    recordType === 'observation' ||
    recordType === 'parent_contact' ||
    recordType === 'guidance' ||
    recordType === 'general_note'
  const canHypothesis =
    !ctx.record ||
    recordType === 'observation' ||
    recordType === 'parent_contact' ||
    recordType === 'guidance'
  const canIntervention = !ctx.record || recordType === 'guidance'

  return (
    <section className="card detailed-tracking">
      <div className="page-header">
        <div>
          <h3 style={{ margin: 0 }}>심층 추적 · Detailed Tracking</h3>
          <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
            학생 자기보고 {voice.length} · 작업 가설 {hypotheses.length} · 개입{' '}
            {interventions.length}
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            관찰 / 자기보고 / 가설 / 개입 / 반응 — 진단이 아닙니다
          </p>
        </div>
        <button type="button" className="btn small" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '열기'}
        </button>
      </div>

      {open && (
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          {error && <p className="error">{error}</p>}

          <Collapsible
            title={`A. Evidence · 무엇을 봤는가 (Voice ${voice.length})`}
            defaultOpen
          >
            <p className="muted small">
              학생 자기보고 · Positive Evidence는 Timeline의 긍정적 기록으로 확인합니다.
              Observation의 ABC는 Record Detail → 심층 기록에서 작성합니다.
            </p>
            {canVoice && (
              <div className="row wrap gap" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setSection(section === 'voice' ? null : 'voice')}
                >
                  + 학생 발언
                </button>
              </div>
            )}
            {section === 'voice' && (
              <VoiceForm
                ctx={ctx}
                onDone={async () => {
                  setSection(null)
                  await reload()
                }}
                onCancel={() => setSection(null)}
              />
            )}
            {voice.length === 0 ? (
              <EmptyHint
                text="학생이 직접 한 말을 관찰과 분리해 기록할 수 있습니다."
                actionLabel={canVoice ? '+ 학생 발언' : undefined}
                onAction={canVoice ? () => setSection('voice') : undefined}
              />
            ) : (
              <ul className="nested-list">
                {voice.map((v) => (
                  <li key={v.id}>
                    <span className="muted small">{v.recorded_at}</span>
                    <pre className="dt-quote">{v.content}</pre>
                  </li>
                ))}
              </ul>
            )}
          </Collapsible>

          <Collapsible
            title={`B. Interpretation · 어떻게 이해하고 있는가 (Hypothesis ${hypotheses.length})`}
            defaultOpen={false}
          >
            <p className="dt-disclaimer">
              교사의 해석이며 확정된 사실이 아닙니다.
            </p>
            {canHypothesis && (
              <div className="row wrap gap" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={() =>
                    setSection(section === 'hypothesis' ? null : 'hypothesis')
                  }
                >
                  + 작업 가설
                </button>
              </div>
            )}
            {section === 'hypothesis' && (
              <HypothesisForm
                ctx={ctx}
                onDone={async () => {
                  setSection(null)
                  await reload()
                }}
                onCancel={() => setSection(null)}
              />
            )}
            {hypotheses.length === 0 ? (
              <EmptyHint
                text="관찰을 바탕으로 검토 중인 설명이 있다면 작업 가설로 기록합니다."
                actionLabel={canHypothesis ? '+ 작업 가설' : undefined}
                onAction={canHypothesis ? () => setSection('hypothesis') : undefined}
              />
            ) : (
              <div className="stack">
                {hypotheses.map((h) => (
                  <HypothesisCard
                    key={h.id}
                    item={h}
                    studentId={ctx.studentId}
                    caseId={ctx.caseId}
                    onChanged={reload}
                  />
                ))}
              </div>
            )}
          </Collapsible>

          <Collapsible
            title={`C. Intervention · 그래서 무엇을 했는가 (${interventions.length})`}
            defaultOpen={false}
          >
            <p className="muted small">
              Guidance 개입 방식과 이후 반응(Response)을 여기에 둡니다.
            </p>
            {canIntervention && (
              <div className="row wrap gap" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={() =>
                    setSection(section === 'intervention' ? null : 'intervention')
                  }
                >
                  + 개입
                </button>
              </div>
            )}
            {section === 'intervention' && (
              <InterventionForm
                ctx={ctx}
                onDone={async () => {
                  setSection(null)
                  await reload()
                }}
                onCancel={() => setSection(null)}
              />
            )}
            {interventions.length === 0 ? (
              <EmptyHint
                text="Guidance Record에 개입을 연결하거나 여기서 기록할 수 있습니다."
                actionLabel={canIntervention ? '+ 개입' : undefined}
                onAction={
                  canIntervention ? () => setSection('intervention') : undefined
                }
              />
            ) : (
              <div className="stack">
                {interventions.map((i) => (
                  <InterventionCard key={i.id} item={i} onChanged={reload} />
                ))}
              </div>
            )}
          </Collapsible>
        </div>
      )}
    </section>
  )
}

function EmptyHint({
  text,
  actionLabel,
  onAction,
}: {
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="dt-empty">
      <p className="muted small" style={{ margin: 0 }}>
        {text}
      </p>
      {actionLabel && onAction && (
        <button type="button" className="btn small" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function Collapsible({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="dt-block">
      <button type="button" className="btn ghost dt-block-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className="dt-block-body">{children}</div>}
    </div>
  )
}

function VoiceForm({
  ctx,
  onDone,
  onCancel,
}: {
  ctx: DetailedTrackingContext
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createStudentVoice({
        student_id: ctx.studentId,
        content,
        recorded_at: date,
        record_id: ctx.record?.id ?? null,
        case_id: ctx.caseId ?? null,
        created_by: user?.id ?? null,
      })
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack nested" onSubmit={(e) => void submit(e)}>
      <p className="muted small">학생이 실제로 말한 표현을 그대로 기록합니다. (해석 금지)</p>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Student Voice *
        <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  )
}

function HypothesisForm({
  ctx,
  onDone,
  onCancel,
}: {
  ctx: DetailedTrackingContext
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [confidence, setConfidence] = useState<HypothesisConfidence>('low')
  const [needMore, setNeedMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createWorkingHypothesis({
        student_id: ctx.studentId,
        hypothesis: text,
        confidence,
        needs_more_observation: needMore,
        case_id: ctx.caseId ?? null,
        record_ids: ctx.record ? [ctx.record.id] : [],
        created_by: user?.id ?? null,
      })
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack nested" onSubmit={(e) => void submit(e)}>
      <p className="dt-disclaimer">
        교사의 해석이며 확정된 사실이 아닙니다. Confidence = 가설 확신도 (위험도 아님)
      </p>
      <label>
        작업 가설 · Working Hypothesis *
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} required />
      </label>
      <label>
        Confidence (가설 확신도)
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value as HypothesisConfidence)}
        >
          {HYPOTHESIS_CONFIDENCE.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={needMore}
          onChange={(e) => setNeedMore(e.target.checked)}
        />
        추가 관찰 필요 · Needs more observation
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  )
}

function HypothesisCard({
  item,
  studentId,
  caseId,
  onChanged,
}: {
  item: WorkingHypothesis
  studentId: string
  caseId?: string | null
  onChanged: () => Promise<void>
}) {
  const [linkingObs, setLinkingObs] = useState(false)
  const [linkingInt, setLinkingInt] = useState(false)
  const [addingInt, setAddingInt] = useState(false)
  const [statusNote, setStatusNote] = useState(item.status_note ?? '')

  async function setStatus(status: HypothesisStatus) {
    await updateWorkingHypothesis(item.id, {
      status,
      status_note: statusNote.trim() || null,
    })
    await onChanged()
  }

  const linkedInterventions = item.hypothesis_interventions ?? []

  return (
    <article className="dt-hypothesis-card">
      <p className="dt-disclaimer small">Interpretation — not an established fact.</p>
      <pre className="dt-quote">{item.hypothesis}</pre>
      <div className="chip-row">
        <span className="badge">
          Confidence {labelOf(HYPOTHESIS_CONFIDENCE, item.confidence)}
        </span>
        <span className="badge">{labelOf(HYPOTHESIS_STATUSES, item.status)}</span>
        {item.needs_more_observation && (
          <span className="badge">추가 관찰 필요</span>
        )}
      </div>

      <div className="bc-section">
        <h4 className="dt-subhead">Evidence</h4>
        <ul className="nested-list">
          {(item.hypothesis_records ?? []).map((hr) => {
            const abc = hasAbcOnRecord(hr.records?.abc_observations)
            return (
              <li key={hr.record_id}>
                {hr.records
                  ? `${formatShortDate(hr.records.record_date)} · ${labelOf(RECORD_TYPES, hr.records.record_type as RecordType)}`
                  : hr.record_id}
                {abc && <span className="badge" style={{ marginLeft: '0.35rem' }}>ABC</span>}
              </li>
            )
          })}
          {(item.hypothesis_records ?? []).length === 0 && (
            <li className="muted">연결된 Observation 없음</li>
          )}
        </ul>
        <button type="button" className="btn ghost small" onClick={() => setLinkingObs(true)}>
          Link Observation
        </button>
      </div>

      <div className="bc-section">
        <h4 className="dt-subhead">Interventions</h4>
        <ul className="nested-list">
          {linkedInterventions.map((hi) => (
            <li key={hi.intervention_id}>
              {hi.interventions
                ? `${labelOf(INTERVENTION_TYPES, hi.interventions.intervention_type)} · ${hi.interventions.applied_at}`
                : hi.intervention_id}
              {hi.interventions?.description && (
                <div className="muted small">{hi.interventions.description.slice(0, 80)}</div>
              )}
            </li>
          ))}
          {linkedInterventions.length === 0 && (
            <li className="muted">연결된 개입 없음</li>
          )}
        </ul>
        <div className="row wrap gap">
          <button type="button" className="btn ghost small" onClick={() => setLinkingInt(true)}>
            Link Intervention
          </button>
          <button type="button" className="btn ghost small" onClick={() => setAddingInt(true)}>
            + Intervention
          </button>
        </div>
      </div>

      <label>
        Status note (optional)
        <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
      </label>
      <div className="row wrap gap">
        {HYPOTHESIS_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`btn small ${item.status === s.value ? 'primary' : 'ghost'}`}
            onClick={() => void setStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {linkingObs && (
        <LinkObservationModal
          studentId={studentId}
          hypothesisId={item.id}
          linkedIds={new Set((item.hypothesis_records ?? []).map((x) => x.record_id))}
          onClose={() => setLinkingObs(false)}
          onLinked={async () => {
            setLinkingObs(false)
            await onChanged()
          }}
        />
      )}
      {linkingInt && (
        <LinkInterventionModal
          studentId={studentId}
          hypothesisId={item.id}
          linkedIds={new Set(linkedInterventions.map((x) => x.intervention_id))}
          onClose={() => setLinkingInt(false)}
          onLinked={async () => {
            setLinkingInt(false)
            await onChanged()
          }}
        />
      )}
      {addingInt && (
        <div className="stack nested" style={{ marginTop: 'var(--space-3)' }}>
          <InterventionForm
            ctx={{ studentId, caseId }}
            hypothesisId={item.id}
            onDone={async () => {
              setAddingInt(false)
              await onChanged()
            }}
            onCancel={() => setAddingInt(false)}
          />
        </div>
      )}
    </article>
  )
}

function LinkObservationModal({
  studentId,
  hypothesisId,
  linkedIds,
  onClose,
  onLinked,
}: {
  studentId: string
  hypothesisId: string
  linkedIds: Set<string>
  onClose: () => void
  onLinked: () => Promise<void>
}) {
  const [records, setRecords] = useState<RecordRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchStudentRecords(studentId)
      .then((rows) => setRecords(rows.filter((r) => r.record_type === 'observation')))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [studentId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Link Observation</h3>
        <p className="muted small">이 학생의 Observation만 표시됩니다.</p>
        {error && <p className="error">{error}</p>}
        <ul className="nested-list">
          {records.map((r) => {
            const linked = linkedIds.has(r.id)
            return (
              <li key={r.id}>
                <strong>{r.record_date}</strong>
                <div className="muted small">{r.content.slice(0, 80)}</div>
                {linked ? (
                  <span className="badge">Already linked</span>
                ) : (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() =>
                      void linkRecordsToHypothesis(hypothesisId, [r.id]).then(onLinked)
                    }
                  >
                    Link
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function LinkInterventionModal({
  studentId,
  hypothesisId,
  linkedIds,
  onClose,
  onLinked,
}: {
  studentId: string
  hypothesisId: string
  linkedIds: Set<string>
  onClose: () => void
  onLinked: () => Promise<void>
}) {
  const [items, setItems] = useState<Intervention[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchInterventions({ studentId })
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [studentId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Link Intervention</h3>
        <p className="muted small">이 학생의 개입만 표시됩니다.</p>
        {error && <p className="error">{error}</p>}
        <ul className="nested-list">
          {items.map((i) => {
            const linked = linkedIds.has(i.id)
            return (
              <li key={i.id}>
                <strong>
                  {labelOf(INTERVENTION_TYPES, i.intervention_type)} · {i.applied_at}
                </strong>
                <div className="muted small">{i.description.slice(0, 80)}</div>
                {linked ? (
                  <span className="badge">Already linked</span>
                ) : (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() =>
                      void linkInterventionsToHypothesis(hypothesisId, [i.id]).then(onLinked)
                    }
                  >
                    Link
                  </button>
                )}
              </li>
            )
          })}
          {items.length === 0 && <li className="muted">연결 가능한 개입 없음</li>}
        </ul>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function InterventionForm({
  ctx,
  onDone,
  onCancel,
  hypothesisId,
}: {
  ctx: DetailedTrackingContext
  onDone: () => Promise<void>
  onCancel: () => void
  hypothesisId?: string
}) {
  const { user } = useAuth()
  const [type, setType] = useState<InterventionType>('study_strategy')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createIntervention({
        student_id: ctx.studentId,
        intervention_type: type,
        description,
        target,
        applied_at: date,
        record_id: ctx.record?.id ?? null,
        case_id: ctx.caseId ?? null,
        created_by: user?.id ?? null,
        hypothesis_ids: hypothesisId ? [hypothesisId] : undefined,
      })
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack nested" onSubmit={(e) => void submit(e)}>
      {hypothesisId && (
        <p className="muted small">생성 후 이 작업 가설에 자동 연결됩니다.</p>
      )}
      <label>
        Type *
        <select
          value={type}
          onChange={(e) => setType(e.target.value as InterventionType)}
        >
          {INTERVENTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description *
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>
      <label>
        Target (optional)
        <input value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label>
        Applied date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  )
}

function InterventionCard({
  item,
  onChanged,
}: {
  item: Intervention
  onChanged: () => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [response, setResponse] = useState('')
  const [responseDate, setResponseDate] = useState(todayISO())
  const [responseType, setResponseType] = useState<ResponseType | ''>('')
  const [busy, setBusy] = useState(false)

  const responses = useMemo(
    () =>
      [...(item.intervention_responses ?? [])].sort((a, b) =>
        a.response_date.localeCompare(b.response_date),
      ),
    [item.intervention_responses],
  )

  const relatedHypotheses = item.hypothesis_interventions ?? []

  async function saveResponse(e: FormEvent) {
    e.preventDefault()
    if (!response.trim()) return
    setBusy(true)
    try {
      await createInterventionResponse({
        intervention_id: item.id,
        response,
        response_date: responseDate,
        response_type: responseType || null,
      })
      setResponse('')
      setAdding(false)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="dt-intervention-card">
      <div className="chip-row">
        <span className="badge">{labelOf(INTERVENTION_TYPES, item.intervention_type)}</span>
        <span className="muted small">{item.applied_at}</span>
      </div>
      <pre className="dt-quote">{item.description}</pre>
      {item.target && <p className="muted small">Target: {item.target}</p>}

      {relatedHypotheses.length > 0 && (
        <div className="bc-section">
          <h4 className="dt-subhead">Related Hypotheses</h4>
          <div className="chip-row">
            {relatedHypotheses.map((hi) => (
              <span key={hi.hypothesis_id} className="chip on">
                {hi.working_hypotheses?.hypothesis?.slice(0, 40) ?? hi.hypothesis_id}
                {hi.working_hypotheses?.hypothesis &&
                hi.working_hypotheses.hypothesis.length > 40
                  ? '…'
                  : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <h4 className="dt-subhead">반응 · Response</h4>
      <ul className="nested-list">
        {responses.map((r) => (
          <li key={r.id}>
            <span className="muted small">{r.response_date}</span>
            {r.response_type && (
              <>
                {' '}
                <span className="badge">{labelOf(RESPONSE_TYPES, r.response_type)}</span>
              </>
            )}
            <pre className="dt-quote">{r.response}</pre>
          </li>
        ))}
        {responses.length === 0 && <li className="muted">아직 Response 없음</li>}
      </ul>
      {!adding ? (
        <button type="button" className="btn ghost small" onClick={() => setAdding(true)}>
          + Response
        </button>
      ) : (
        <form className="stack nested" onSubmit={(e) => void saveResponse(e)}>
          <label>
            Date
            <input
              type="date"
              value={responseDate}
              onChange={(e) => setResponseDate(e.target.value)}
            />
          </label>
          <label>
            Type
            <select
              value={responseType}
              onChange={(e) => setResponseType(e.target.value as ResponseType | '')}
            >
              <option value="">미지정</option>
              {RESPONSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Response *
            <textarea
              rows={2}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              required
            />
          </label>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              Save
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
