import { useEffect, useMemo, useState } from 'react'
import { fetchPatternSourceBundle } from '../lib/api'
import {
  HYPOTHESIS_CONFIDENCE,
  INTERVENTION_TYPES,
  PARENT_STATUSES,
  RECORD_TYPES,
  RESPONSE_TYPES,
  formatShortDate,
  labelOf,
} from '../lib/constants'
import type { RecordRow, RecordType } from '../lib/types'
import {
  buildPatternReport,
  resolvePatternDateRange,
  type InterventionTypeSummary,
  type PatternRangePreset,
  type PatternReport,
  type PatternSourceBundle,
} from '../lib/patternTracker'
import { RecordDetailModal } from './RecordDetailModal'

export function PatternTrackerModal({
  studentId,
  studentName,
  onClose,
  onOpenCase,
}: {
  studentId: string
  studentName: string
  onClose: () => void
  onOpenCase?: (caseId: string) => void
}) {
  const [bundle, setBundle] = useState<PatternSourceBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<PatternRangePreset>('current_term')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [tagFilterType, setTagFilterType] = useState<RecordType | 'all'>('observation')
  const [crossFocus, setCrossFocus] = useState<'context' | 'tag'>('context')
  const [crossKey, setCrossKey] = useState<string>('')
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [showOtherHypotheses, setShowOtherHypotheses] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void fetchPatternSourceBundle(studentId)
      .then(setBundle)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [studentId])

  const range = useMemo(() => {
    if (!bundle) {
      return resolvePatternDateRange('current_term', null)
    }
    return resolvePatternDateRange(
      preset,
      bundle.currentTerm,
      preset === 'custom'
        ? { start: customStart, end: customEnd }
        : undefined,
    )
  }, [bundle, preset, customStart, customEnd])

  const report: PatternReport | null = useMemo(() => {
    if (!bundle) return null
    return buildPatternReport(bundle, range, {
      labelOfIntervention: (t) =>
        labelOf(INTERVENTION_TYPES, t as (typeof INTERVENTION_TYPES)[number]['value']),
      labelOfResponse: (t) =>
        labelOf(RESPONSE_TYPES, t as (typeof RESPONSE_TYPES)[number]['value']),
      labelOfRecordType: (t) => labelOf(RECORD_TYPES, t),
      tagFilterType,
    })
  }, [bundle, range, tagFilterType])

  const maxContext = report?.contextDistribution[0]?.count ?? 1
  const maxTrend = Math.max(1, ...(report?.timeTrend.map((b) => b.count) ?? [1]))

  const crossRows = useMemo(() => {
    if (!report) return []
    if (!crossKey) return report.crossTab.slice(0, 12)
    if (crossFocus === 'context') {
      return report.crossTab
        .filter((c) => c.contextKey === crossKey)
        .map((c) => ({ key: c.tagKey, label: c.tagLabel, count: c.count }))
    }
    return report.crossTab
      .filter((c) => c.tagKey === crossKey)
      .map((c) => ({ key: c.contextKey, label: c.contextLabel, count: c.count }))
  }, [report, crossFocus, crossKey])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal pattern-tracker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pattern-tracker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="page-header">
          <div>
            <h2 id="pattern-tracker-title" style={{ margin: 0 }}>
              관찰 패턴 · Pattern Tracker
            </h2>
            <p className="muted small" style={{ margin: 0 }}>
              {studentName}
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="dt-disclaimer">
          이 화면은 기록된 관찰·맥락·개입의 분포를 정리합니다. 표시된 빈도는 학생의 성격이나
          진단을 의미하지 않습니다.
        </p>

        {loading && <p className="muted">불러오는 중…</p>}
        {error && <p className="error">{error}</p>}

        {report && bundle && (
          <div className="stack pattern-sections">
            <section className="pattern-section">
              <h3>기간</h3>
              <div className="row wrap gap">
                {(
                  [
                    ['current_term', '현재 학기'],
                    ['last_30', '최근 30일'],
                    ['last_90', '최근 90일'],
                    ['all', '전체'],
                    ['custom', '사용자 지정'],
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
              </div>
              {preset === 'custom' && (
                <div className="row wrap gap" style={{ marginTop: '0.5rem' }}>
                  <label>
                    시작
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </label>
                  <label>
                    종료
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <p className="muted small">{report.range.label}</p>
              {report.managementStatus && (
                <p className="muted small">
                  관리상태: {labelOf(PARENT_STATUSES, report.managementStatus)}
                </p>
              )}
            </section>

            <section className="pattern-section">
              <h3>기록 수 · Record Density</h3>
              <p className="muted small">기록 수는 문제의 심각도를 의미하지 않습니다.</p>
              <CountList items={report.recordDensity} empty="기간 내 기록 없음" />
            </section>

            <section className="pattern-section">
              <h3>Context Distribution</h3>
              <p className="muted small">
                Observation만 집계 · 하나의 관찰에 여러 Context가 연결될 수 있습니다.
              </p>
              {report.contextDistribution.length === 0 ? (
                <p className="muted">아직 Context가 연결된 Observation이 없습니다.</p>
              ) : (
                <ul className="pattern-bars">
                  {report.contextDistribution.map((c) => (
                    <li key={c.key}>
                      <div className="pattern-bar-label">
                        <span>{c.label}</span>
                        <strong>{c.count}</strong>
                      </div>
                      <div className="pattern-bar-track">
                        <div
                          className="pattern-bar-fill"
                          style={{ width: `${(c.count / maxContext) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pattern-section">
              <h3>Tag Pattern</h3>
              <div className="row wrap gap">
                {(
                  [
                    ['observation', 'Observation'],
                    ['guidance', 'Guidance'],
                    ['positive_note', 'Positive Note'],
                    ['all', 'All'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn small ${tagFilterType === value ? 'primary' : 'ghost'}`}
                    onClick={() => setTagFilterType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <CountList items={report.tagCounts} empty="기간 내 Tag 없음" />
            </section>

            <section className="pattern-section">
              <h3>Context × Tag</h3>
              <p className="muted small">단순 교차 집계 · 통계 추론 없음</p>
              <div className="row wrap gap">
                <button
                  type="button"
                  className={`btn small ${crossFocus === 'context' ? 'primary' : 'ghost'}`}
                  onClick={() => {
                    setCrossFocus('context')
                    setCrossKey('')
                  }}
                >
                  Context 기준
                </button>
                <button
                  type="button"
                  className={`btn small ${crossFocus === 'tag' ? 'primary' : 'ghost'}`}
                  onClick={() => {
                    setCrossFocus('tag')
                    setCrossKey('')
                  }}
                >
                  Tag 기준
                </button>
              </div>
              <div className="chip-row" style={{ marginTop: '0.5rem' }}>
                {(crossFocus === 'context'
                  ? report.contextDistribution
                  : report.tagCounts
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`chip ${crossKey === item.key ? 'on' : ''}`}
                    onClick={() =>
                      setCrossKey((k) => (k === item.key ? '' : item.key))
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {crossKey ? (
                <CountList
                  items={crossRows as { key: string; label: string; count: number }[]}
                  empty="교차 데이터 없음"
                />
              ) : (
                <ul className="nested-list">
                  {report.crossTab.slice(0, 12).map((c) => (
                    <li key={`${c.contextKey}-${c.tagKey}`}>
                      {c.contextLabel} × {c.tagLabel}{' '}
                      <strong>{c.count}</strong>
                    </li>
                  ))}
                  {report.crossTab.length === 0 && (
                    <li className="muted">Context와 Tag가 함께 있는 Observation 없음</li>
                  )}
                </ul>
              )}
            </section>

            <section className="pattern-section">
              <h3>ABC Overview · {report.abcCount}</h3>
              <p className="muted small">Behavior 텍스트를 자동 분류하지 않습니다.</p>
              {report.recentAbcs.length === 0 ? (
                <p className="muted">기간 내 ABC 없음</p>
              ) : (
                <ul className="nested-list">
                  {report.recentAbcs.map((item) => (
                    <li key={item.abc.id}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ textAlign: 'left', padding: 0 }}
                        onClick={() => {
                          const rec = bundle.records.find((r) => r.id === item.recordId)
                          if (rec) setSelectedRecord(rec)
                        }}
                      >
                        <strong>
                          {formatShortDate(item.recordDate)}
                          {item.contexts.length > 0 &&
                            ` · ${item.contexts.map((c) => c.label).join(' / ')}`}
                        </strong>
                      </button>
                      <div className="muted small">Behavior: {item.behaviorSnippet}</div>
                      <div className="muted small">
                        Consequence: {item.consequenceSnippet}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pattern-section">
              <h3>Intervention / Response</h3>
              <p className="muted small">
                하나의 Intervention에 여러 시점의 Response가 기록될 수 있습니다. 효과율·성공률은
                계산하지 않습니다.
              </p>
              {report.interventionSummaries.length === 0 ? (
                <p className="muted">기간 내 개입 없음</p>
              ) : (
                <div className="stack">
                  {report.interventionSummaries.map((s) => (
                    <InterventionSummaryBlock
                      key={s.type}
                      summary={s}
                      expanded={expandedType === s.type}
                      onToggle={() =>
                        setExpandedType((t) => (t === s.type ? null : s.type))
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="pattern-section">
              <h3>
                Observation Trend ({report.timeTrendMode === 'week' ? '주별' : '월별'})
              </h3>
              {report.timeTrend.length === 0 ? (
                <p className="muted">기간 내 Observation 없음</p>
              ) : (
                <ul className="pattern-bars">
                  {report.timeTrend.map((b) => (
                    <li key={b.key}>
                      <div className="pattern-bar-label">
                        <span>{b.label}</span>
                        <strong>{b.count}</strong>
                      </div>
                      <div className="pattern-bar-track">
                        <div
                          className="pattern-bar-fill"
                          style={{ width: `${(b.count / maxTrend) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pattern-section">
              <h3>Positive Notes</h3>
              <CountList items={report.positiveTagCounts} empty="기간 내 Positive Note Tag 없음" />
              {report.recentPositiveNotes.length > 0 && (
                <ul className="nested-list">
                  {report.recentPositiveNotes.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ textAlign: 'left', padding: 0 }}
                        onClick={() => setSelectedRecord(r)}
                      >
                        <strong>{formatShortDate(r.record_date)}</strong>
                      </button>
                      <div className="muted small">{r.content.slice(0, 100)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pattern-section">
              <h3>Active Working Hypotheses · {report.activeHypotheses.length}</h3>
              <p className="muted small">
                Pattern이 Hypothesis를 자동으로 지지하거나 생성하지 않습니다.
              </p>
              {report.activeHypotheses.length === 0 ? (
                <p className="muted">Active 작업 가설 없음</p>
              ) : (
                <ul className="nested-list">
                  {report.activeHypotheses.map((h) => (
                    <li key={h.id}>
                      <pre className="dt-quote">{h.hypothesis}</pre>
                      <div className="chip-row">
                        <span className="badge">
                          Confidence {labelOf(HYPOTHESIS_CONFIDENCE, h.confidence)}
                        </span>
                        <span className="badge">
                          Evidence {(h.hypothesis_records ?? []).length}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {report.otherHypotheses.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => setShowOtherHypotheses((v) => !v)}
                  >
                    {showOtherHypotheses ? '접기' : 'Supported / Closed 등 보기'}
                  </button>
                  {showOtherHypotheses && (
                    <ul className="nested-list">
                      {report.otherHypotheses.map((h) => (
                        <li key={h.id}>
                          <span className="badge">{h.status}</span>{' '}
                          {h.hypothesis.slice(0, 80)}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            <section className="pattern-section">
              <h3>Active Cases · {report.activeCases.length}</h3>
              {report.activeCases.length === 0 ? (
                <p className="muted">Active Case 없음</p>
              ) : (
                <ul className="nested-list">
                  {report.activeCases.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ textAlign: 'left', padding: 0 }}
                        onClick={() => onOpenCase?.(c.id)}
                      >
                        <strong>{c.title}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {selectedRecord && (
          <RecordDetailModal
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onChanged={async () => {
              const next = await fetchPatternSourceBundle(studentId)
              setBundle(next)
              const updated = next.records.find((r) => r.id === selectedRecord.id)
              setSelectedRecord(updated ?? null)
            }}
          />
        )}
      </div>
    </div>
  )
}

function CountList({
  items,
  empty,
}: {
  items: { key: string; label: string; count: number }[]
  empty: string
}) {
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="nested-list">
      {items.map((i) => (
        <li key={i.key}>
          {i.label} <strong>{i.count}</strong>
        </li>
      ))}
    </ul>
  )
}

function InterventionSummaryBlock({
  summary,
  expanded,
  onToggle,
}: {
  summary: InterventionTypeSummary
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <article className="dt-intervention-card">
      <button type="button" className="btn ghost" style={{ padding: 0 }} onClick={onToggle}>
        <strong>
          {summary.label} · Interventions {summary.interventionCount}
        </strong>
      </button>
      <p className="muted small" style={{ margin: '0.25rem 0' }}>
        {summary.label}에 연결된 Response 기록:{' '}
        {summary.responsesByType.length === 0
          ? '없음'
          : summary.responsesByType.map((r) => `${r.label} ${r.count}`).join(', ')}
      </p>
      {expanded && (
        <ul className="nested-list">
          {summary.interventions.map((i) => (
            <li key={i.id}>
              <strong>{i.applied_at}</strong>
              <div className="muted small">{i.description}</div>
              {(i.hypothesis_interventions ?? []).length > 0 && (
                <div className="chip-row">
                  {(i.hypothesis_interventions ?? []).map((hi) => (
                    <span key={hi.hypothesis_id} className="chip on">
                      {hi.working_hypotheses?.hypothesis?.slice(0, 36) ?? 'Hypothesis'}
                    </span>
                  ))}
                </div>
              )}
              <ul className="nested-list">
                {(i.intervention_responses ?? []).map((r) => (
                  <li key={r.id}>
                    {r.response_date}
                    {r.response_type
                      ? ` · ${labelOf(RESPONSE_TYPES, r.response_type)}`
                      : ''}
                    : {r.response.slice(0, 80)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
