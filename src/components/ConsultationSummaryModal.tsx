import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createConsultationNote,
  fetchStudentOverviewBundle,
} from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  HYPOTHESIS_CONFIDENCE,
  PARENT_STATUSES,
  RECORD_TYPES,
  formatShortDate,
  labelOf,
  todayISO,
} from '../lib/constants'
import {
  buildConsultationBrief,
  buildConsultationPlainText,
  buildConsultationSummaryModel,
  type ConsultationSummaryModel,
  type StudentOverviewBundle,
} from '../lib/studentSummary'
import type { PatternRangePreset } from '../lib/patternTracker'

export function ConsultationSummaryModal({
  studentId,
  initialBundle,
  onClose,
  onSaved,
  onOpenMessages,
  onOpenPatterns,
  createdBy,
}: {
  studentId: string
  initialBundle?: StudentOverviewBundle | null
  onClose: () => void
  onSaved?: () => Promise<void> | void
  onOpenMessages?: () => void
  onOpenPatterns?: () => void
  createdBy?: string | null
}) {
  const [bundle, setBundle] = useState<StudentOverviewBundle | null>(
    initialBundle ?? null,
  )
  const [loading, setLoading] = useState(!initialBundle)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<PatternRangePreset>('last_30')
  const [talkingPoints, setTalkingPoints] = useState('')
  const [outcome, setOutcome] = useState('')
  const [consultDate, setConsultDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (initialBundle) {
      setBundle(initialBundle)
      return
    }
    setLoading(true)
    void fetchStudentOverviewBundle(studentId)
      .then(setBundle)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [studentId, initialBundle])

  const model: ConsultationSummaryModel | null = useMemo(() => {
    if (!bundle) return null
    const classLabel = bundle.student.classes
      ? formatClassDisplay({ ...bundle.student.classes, includeTerm: true })
      : '반 미지정'
    return buildConsultationSummaryModel(bundle, preset, {
      classLabel,
      labelOfRecordType: (t) => labelOf(RECORD_TYPES, t),
    })
  }, [bundle, preset])

  async function copySummary() {
    if (!model) return
    const text = buildConsultationPlainText(model)
    await navigator.clipboard.writeText(text)
    setCopyToast(true)
    window.setTimeout(() => setCopyToast(false), 2000)
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault()
    if (!model) return
    if (!talkingPoints.trim() && !outcome.trim()) {
      setError('Talking Points 또는 Outcome을 입력하세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createConsultationNote({
        student_id: studentId,
        consultation_date: consultDate,
        period_start: model.range.start,
        period_end: model.range.end,
        talking_points: talkingPoints,
        outcome,
        created_by: createdBy ?? null,
      })
      setTalkingPoints('')
      setOutcome('')
      const next = await fetchStudentOverviewBundle(studentId)
      setBundle(next)
      await onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal consultation-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consultation-summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="page-header">
          <div>
            <h2 id="consultation-summary-title" style={{ margin: 0 }}>
              상담 요약 · Consultation Summary
            </h2>
            {model && (
              <p className="muted small" style={{ margin: 0 }}>
                {model.student.korean_name}
                {model.student.english_name
                  ? ` / ${model.student.english_name}`
                  : ''}
                {' · '}
                {model.classLabel}
              </p>
            )}
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="dt-disclaimer">
          관찰·자기보고·교사 해석을 구분해서 봅니다. 자동 진단이나 상담 추천을 만들지
          않습니다.
        </p>

        {loading && <p className="muted">불러오는 중…</p>}
        {error && <p className="error">{error}</p>}
        {copyToast && <p className="toast-inline">상담 요약을 복사했습니다.</p>}

        {model && (
          <div className="stack">
            <div className="row wrap gap">
              {(
                [
                  ['last_30', '최근 30일'],
                  ['current_term', '현재 학기'],
                  ['last_90', '최근 90일'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn small ${preset === value ? 'primary' : 'ghost'}`}
                  onClick={() => setPreset(value)}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="btn small" onClick={() => void copySummary()}>
                Copy Summary
              </button>
            </div>
            <p className="muted small">{model.range.label}</p>
            <p className="muted small">
              관리상태:{' '}
              {labelOf(PARENT_STATUSES, model.student.parent_management_status)}
            </p>

            <ConsultationBriefBlock model={model} />

            <section className="consult-block">
              <h3>1. Current Focus</h3>
              {model.openFocus.length === 0 ? (
                <p className="muted">없음</p>
              ) : (
                <ul className="nested-list">
                  {model.openFocus.map((f) => (
                    <li key={f.id}>
                      <strong>{f.title}</strong>
                      {f.note ? ` — ${f.note}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="consult-block observed">
              <h3>2. Observed / Recorded</h3>
              <ul className="nested-list">
                {model.recentSnapshot.counts.map((c) => (
                  <li key={c.key}>
                    {c.label} <strong>{c.count}</strong>
                  </li>
                ))}
              </ul>
              {model.recentSnapshot.importantRecords.length > 0 && (
                <>
                  <h4 className="dt-subhead">최근 Important</h4>
                  <ul className="nested-list">
                    {model.recentSnapshot.importantRecords.slice(0, 3).map((r) => (
                      <li key={r.id}>
                        {formatShortDate(r.record_date)} {r.content.slice(0, 100)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {model.topContexts.length > 0 && (
                <>
                  <h4 className="dt-subhead">주요 Context</h4>
                  <ul className="nested-list">
                    {model.topContexts.map((c) => (
                      <li key={c.key}>
                        {c.label} <strong>{c.count}</strong>
                      </li>
                    ))}
                  </ul>
                  {onOpenPatterns && (
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={onOpenPatterns}
                    >
                      전체 Pattern 보기
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="consult-block positive">
              <h3>3. Positive Evidence</h3>
              {model.recentPositiveNotes.length === 0 ? (
                <p className="muted">없음</p>
              ) : (
                <ul className="nested-list">
                  {model.recentPositiveNotes.map((r) => (
                    <li key={r.id}>
                      {formatShortDate(r.record_date)} {r.content.slice(0, 120)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="consult-block voice">
              <h3>4. Student Said · Student Voice</h3>
              {model.recentVoice.length === 0 ? (
                <p className="muted">없음</p>
              ) : (
                <ul className="nested-list">
                  {model.recentVoice.map((v) => (
                    <li key={v.id}>
                      <span className="muted small">{v.recorded_at}</span>
                      <pre className="dt-quote">“{v.content}”</pre>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="consult-block">
              <h3>5. Current Management</h3>
              <ul className="nested-list">
                <li>Active Case {model.activeCaseCount}</li>
                <li>Open Follow-up {model.openFollowupCount}</li>
                <li>Pending Stamp {model.pendingStampCount}</li>
              </ul>
            </section>

            <section className="consult-block">
              <h3>6. Recent Parent Contact</h3>
              {model.recentParentContacts.length === 0 ? (
                <p className="muted">없음</p>
              ) : (
                <ul className="nested-list">
                  {model.recentParentContacts.map((r) => (
                    <li key={r.id}>
                      <strong>{formatShortDate(r.record_date)}</strong>
                      <div className="muted small">{r.content.slice(0, 140)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {onOpenMessages && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={onOpenMessages}
                >
                  관련 Messages 보기 ({model.messageCount})
                </button>
              )}
            </section>

            <section className="consult-block interpretation">
              <h3>7. Teacher Interpretation · Working Hypothesis</h3>
              <p className="dt-disclaimer small">
                교사의 해석이며 확정된 사실이 아닙니다.
              </p>
              {model.activeHypotheses.length === 0 ? (
                <p className="muted">Active 작업 가설 없음</p>
              ) : (
                <ul className="nested-list">
                  {model.activeHypotheses.map((h) => (
                    <li key={h.id}>
                      <pre className="dt-quote">{h.hypothesis}</pre>
                      <span className="badge">
                        Confidence {labelOf(HYPOTHESIS_CONFIDENCE, h.confidence)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="consult-block">
              <h3>상담 메모 / Talking Points</h3>
              <form className="stack" onSubmit={(e) => void saveNote(e)}>
                <label>
                  상담 날짜
                  <input
                    type="date"
                    value={consultDate}
                    onChange={(e) => setConsultDate(e.target.value)}
                  />
                </label>
                <label>
                  Talking Points
                  <textarea
                    rows={4}
                    value={talkingPoints}
                    onChange={(e) => setTalkingPoints(e.target.value)}
                    placeholder="상담에서 이야기할 포인트를 직접 적습니다."
                  />
                </label>
                <label>
                  Outcome (상담 후)
                  <textarea
                    rows={3}
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="상담 결과 요약 (선택)"
                  />
                </label>
                <div className="row end">
                  <button type="submit" className="btn primary" disabled={busy}>
                    Save Consultation Note
                  </button>
                </div>
              </form>
            </section>

            <section className="consult-block">
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? '상담 기록 접기' : `상담 기록 (${model.consultations.length})`}
              </button>
              {showHistory && (
                <ul className="nested-list" style={{ marginTop: '0.75rem' }}>
                  {model.consultations.length === 0 && (
                    <li className="muted">저장된 상담 기록 없음</li>
                  )}
                  {model.consultations.map((n) => (
                    <li key={n.id}>
                      <strong>{n.consultation_date} 상담</strong>
                      {n.talking_points && (
                        <pre className="dt-quote">{n.talking_points}</pre>
                      )}
                      {n.outcome && (
                        <p className="muted small">Outcome: {n.outcome}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function BriefList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="consult-brief-row">
      <strong>{label}</strong>
      {items.length === 0 ? (
        <span className="muted small">—</span>
      ) : (
        <ul className="consult-brief-list">
          {items.map((x, i) => (
            <li key={`${label}-${i}`}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ConsultationBriefBlock({ model }: { model: ConsultationSummaryModel }) {
  const brief = useMemo(() => buildConsultationBrief(model), [model])
  return (
    <section className="consult-brief" aria-label="Consultation Brief">
      <h3 style={{ marginTop: 0 }}>Consultation Brief</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        상담 직전 20~30초 핵심 복구용. 아래 상세와 별도입니다.
      </p>
      <BriefList label="Current Focus" items={brief.focusLines} />
      <BriefList label="Active Case" items={brief.activeCaseLines} />
      <BriefList label="Recent Change" items={brief.recentChangeLines} />
      <BriefList label="Positive" items={brief.positiveLines} />
      <BriefList label="Working Hypothesis" items={brief.hypothesisLines} />
      <BriefList label="Open Action" items={brief.openActionLines} />
      <BriefList label="Talking Points" items={brief.talkingPointHints} />
    </section>
  )
}
