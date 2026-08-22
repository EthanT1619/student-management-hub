import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchStudentOverviewBundle } from '../lib/api'
import { formatClassDisplay } from '../lib/classFormat'
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  HYPOTHESIS_CONFIDENCE,
  INTERVENTION_TYPES,
  PARENT_STATUSES,
  RECORD_TYPES,
  RESPONSE_TYPES,
  formatShortDate,
  labelOf,
} from '../lib/constants'
import {
  buildLearningProfileModel,
  type LearningProfileModel,
  type StudentOverviewBundle,
} from '../lib/studentSummary'
import { useAuth } from '../context/AuthContext'
import { RecordDetailModal } from '../components/RecordDetailModal'
import { PatternTrackerModal } from '../components/PatternTrackerModal'
import { StudentMessagesModal } from '../components/StudentMessagesModal'
import { CaseDetailModal } from '../components/cases/CaseDetailModal'
import { ConsultationSummaryModal } from '../components/ConsultationSummaryModal'
import type { RecordRow } from '../lib/types'

export function LearningProfilePage({
  refreshKey,
  onDataChanged,
  onOpenQuickRecord,
}: {
  refreshKey: number
  onDataChanged?: () => void
  onOpenQuickRecord?: (studentId: string, caseId?: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bundle, setBundle] = useState<StudentOverviewBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deepOpen, setDeepOpen] = useState({
    pattern: true,
    voice: false,
    hypothesis: false,
    intervention: false,
    parent: false,
    consult: false,
  })
  const [showPatterns, setShowPatterns] = useState(false)
  const [showConsultation, setShowConsultation] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setBundle(await fetchStudentOverviewBundle(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const model: LearningProfileModel | null = useMemo(() => {
    if (!bundle) return null
    const classLabel = bundle.student.classes
      ? formatClassDisplay({ ...bundle.student.classes, includeTerm: true })
      : '반 미지정'
    return buildLearningProfileModel(bundle, {
      classLabel,
      labelOfRecordType: (t) => labelOf(RECORD_TYPES, t),
      labelOfIntervention: (t) =>
        labelOf(INTERVENTION_TYPES, t as (typeof INTERVENTION_TYPES)[number]['value']),
      labelOfResponse: (t) =>
        labelOf(RESPONSE_TYPES, t as (typeof RESPONSE_TYPES)[number]['value']),
    })
  }, [bundle])

  if (loading && !model) return <p className="muted center-pad">Loading…</p>
  if (!model || !bundle) {
    return (
      <div className="page">
        <p className="error">{error ?? '학생을 찾을 수 없습니다.'}</p>
        <Link to="/students">← Students</Link>
      </div>
    )
  }

  const s = model.student

  return (
    <div className="page learning-profile-page">
      <div className="page-header">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            <Link to={`/students/${s.id}`}>← Student Profile</Link>
          </p>
          <h1 style={{ margin: '0.35rem 0 0' }}>
            {s.accent_color && (
              <span className={`accent-dot accent-${s.accent_color}`} />
            )}
            종합 프로필 · Learning & Behavior Profile
          </h1>
          <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
            학생의 현재 업무 상태가 아니라, 누적 기록을 통해 장기적인 변화 흐름을 보는
            화면입니다.
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            오늘 해야 할 일(Follow-up / Stamp)은 Student Profile에서 우선 확인하세요.
          </p>
        </div>
        <div className="row wrap gap">
          <button
            type="button"
            className="btn small"
            onClick={() => setShowConsultation(true)}
          >
            상담 요약
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigate(`/students/${s.id}`)}
          >
            Close
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          {s.korean_name}
          {s.english_name ? ` / ${s.english_name}` : ''}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {model.classLabel}
          {model.termLabel ? ` · ${model.termLabel}` : ''}
        </p>
        <div className="chip-row" style={{ marginTop: '0.75rem' }}>
          <span className={`badge badge-mgmt ${s.parent_management_status}`}>
            관리상태: {labelOf(PARENT_STATUSES, s.parent_management_status)}
          </span>
          <span className="badge">Current Focus {model.openFocusCount}</span>
          <span className="badge">Active Cases {model.activeCaseCount}</span>
          <span className="badge">Open Follow-ups {model.openFollowupCount}</span>
          <span className="badge">Pending Stamp {model.pendingStampCount}</span>
        </div>
      </section>

      <section className="card section-longitudinal">
        <h3>Focus 흐름</h3>
        {model.openFocus.length === 0 ? (
          <p className="muted">Open Focus 없음</p>
        ) : (
          <ul className="nested-list">
            {model.openFocus.map((f) => (
              <li key={f.id}>
                <strong>{f.title}</strong>
                {f.note && <div className="muted small">{f.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section-longitudinal">
        <h3>Case history · Active</h3>
        {model.activeCases.length === 0 ? (
          <p className="muted">Active Case 없음</p>
        ) : (
          <ul className="nested-list">
            {model.activeCases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => setSelectedCaseId(c.id)}
                >
                  <strong>{c.title}</strong>
                </button>
                <div className="chip-row">
                  <span className={`badge badge-case-${c.status}`}>
                    {labelOf(CASE_STATUSES, c.status)}
                  </span>
                  <span className={`badge badge-priority-${c.priority}`}>
                    {labelOf(CASE_PRIORITIES, c.priority)}
                  </span>
                </div>
                {c.goal && <p className="muted small">Goal: {c.goal}</p>}
                <p className="muted small">
                  Related Records {model.caseMeta[c.id]?.relatedRecords ?? 0} · Open
                  Follow-ups {model.caseMeta[c.id]?.openFollowups ?? 0}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section-longitudinal">
        <h3>Positive trajectory</h3>
        <p className="muted small">최근 30일 Positive Note 중심</p>
        {model.positiveTagCounts.length > 0 && (
          <ul className="nested-list">
            {model.positiveTagCounts.map((t) => (
              <li key={t.key}>
                {t.label} <strong>{t.count}</strong>
              </li>
            ))}
          </ul>
        )}
        {model.recentPositiveNotes.length === 0 ? (
          <p className="muted">최근 Positive Note 없음</p>
        ) : (
          <ul className="nested-list">
            {model.recentPositiveNotes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => setSelectedRecord(r)}
                >
                  <strong>{formatShortDate(r.record_date)}</strong>
                </button>
                <div className="muted small">{r.content.slice(0, 120)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card section-longitudinal">
        <h3>Recent Snapshot · 최근 30일</h3>
        <p className="muted small">기록 수는 문제의 심각도를 의미하지 않습니다.</p>
        <ul className="nested-list">
          {model.recentSnapshot.counts.map((c) => (
            <li key={c.key}>
              {c.label} <strong>{c.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <details className="card section-ops-secondary">
        <summary>
          <strong>Open Actions</strong>
          <span className="muted small"> · 오늘 할 일 (Profile에서 우선)</span>
        </summary>
        {model.openActions.length === 0 ? (
          <p className="muted">열린 액션 없음</p>
        ) : (
          <ul className="nested-list">
            {model.openActions.map((a, i) => (
              <li key={`${a.kind}-${a.recordId}-${i}`}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => {
                    const rec = bundle.records.find((r) => r.id === a.recordId)
                    if (rec) setSelectedRecord(rec)
                  }}
                >
                  <span className="badge">{a.kind.toUpperCase()}</span>{' '}
                  <strong>{a.title}</strong>
                </button>
                <div className="muted small">
                  {a.dueDate ? `Due ${a.dueDate} · ` : ''}
                  {a.detail}
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>

      <CollapsibleSection
        title="Observation Pattern"
        open={deepOpen.pattern}
        onToggle={() => setDeepOpen((d) => ({ ...d, pattern: !d.pattern }))}
      >
        <p className="muted small">{model.patternRangeLabel}</p>
        <h4 className="dt-subhead">Top Context</h4>
        {model.patternTopContexts.length === 0 ? (
          <p className="muted">Context 데이터 없음</p>
        ) : (
          <ul className="nested-list">
            {model.patternTopContexts.map((c) => (
              <li key={c.key}>
                {c.label} <strong>{c.count}</strong>
              </li>
            ))}
          </ul>
        )}
        <h4 className="dt-subhead">Top Tags</h4>
        {model.patternTopTags.length === 0 ? (
          <p className="muted">Tag 데이터 없음</p>
        ) : (
          <ul className="nested-list">
            {model.patternTopTags.map((t) => (
              <li key={t.key}>
                {t.label} <strong>{t.count}</strong>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn small" onClick={() => setShowPatterns(true)}>
          전체 Pattern 보기
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="Student Voice"
        open={deepOpen.voice}
        onToggle={() => setDeepOpen((d) => ({ ...d, voice: !d.voice }))}
      >
        <p className="muted small">학생이 말한 표현 · 해석과 분리</p>
        {model.recentVoice.length === 0 ? (
          <p className="muted">최근 Student Voice 없음</p>
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Working Hypotheses"
        open={deepOpen.hypothesis}
        onToggle={() => setDeepOpen((d) => ({ ...d, hypothesis: !d.hypothesis }))}
      >
        <p className="dt-disclaimer">
          작업 가설은 교사의 해석이며 확정된 사실이 아닙니다.
        </p>
        {model.activeHypotheses.length === 0 ? (
          <p className="muted">Active 작업 가설 없음</p>
        ) : (
          <ul className="nested-list">
            {model.activeHypotheses.map((h) => (
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Interventions / Responses"
        open={deepOpen.intervention}
        onToggle={() =>
          setDeepOpen((d) => ({ ...d, intervention: !d.intervention }))
        }
      >
        <p className="muted small">효과율·성공률은 표시하지 않습니다.</p>
        {model.interventionSummaries.length === 0 ? (
          <p className="muted">기간 내 개입 요약 없음</p>
        ) : (
          <ul className="nested-list">
            {model.interventionSummaries.map((i) => (
              <li key={i.type}>
                <strong>
                  {i.label} · {i.interventionCount}
                </strong>
                <div className="muted small">
                  Responses:{' '}
                  {i.responsesByType.length === 0
                    ? '없음'
                    : i.responsesByType.map((r) => `${r.label} ${r.count}`).join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Parent Communication"
        open={deepOpen.parent}
        onToggle={() => setDeepOpen((d) => ({ ...d, parent: !d.parent }))}
      >
        {model.recentParentContacts.length === 0 ? (
          <p className="muted">최근 Parent Contact 없음</p>
        ) : (
          <ul className="nested-list">
            {model.recentParentContacts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() => setSelectedRecord(r)}
                >
                  <strong>{formatShortDate(r.record_date)}</strong>
                </button>
                <div className="muted small">{r.content.slice(0, 140)}</div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setShowMessages(true)}
        >
          관련 Messages 보기 ({model.messageCount})
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title={`상담 기록 · Consultations (${model.consultations.length})`}
        open={deepOpen.consult}
        onToggle={() => setDeepOpen((d) => ({ ...d, consult: !d.consult }))}
      >
        {model.consultations.length === 0 ? (
          <p className="muted">저장된 상담 기록 없음</p>
        ) : (
          <ul className="nested-list">
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
        <button
          type="button"
          className="btn small"
          onClick={() => setShowConsultation(true)}
        >
          상담 요약 열기
        </button>
      </CollapsibleSection>

      {showPatterns && (
        <PatternTrackerModal
          studentId={s.id}
          studentName={s.korean_name}
          onClose={() => setShowPatterns(false)}
          onOpenCase={(caseId) => {
            setShowPatterns(false)
            setSelectedCaseId(caseId)
          }}
        />
      )}

      {showConsultation && (
        <ConsultationSummaryModal
          studentId={s.id}
          initialBundle={bundle}
          onClose={() => setShowConsultation(false)}
          onSaved={async () => {
            await load()
            onDataChanged?.()
          }}
          onOpenMessages={() => {
            setShowConsultation(false)
            setShowMessages(true)
          }}
          onOpenPatterns={() => {
            setShowConsultation(false)
            setShowPatterns(true)
          }}
          createdBy={user?.id ?? null}
        />
      )}

      {showMessages && (
        <StudentMessagesModal
          studentId={s.id}
          studentName={s.korean_name}
          onClose={() => setShowMessages(false)}
        />
      )}

      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onChanged={async () => {
            await load()
            onDataChanged?.()
          }}
          onOpenQuickRecord={({ studentId, caseId }) =>
            onOpenQuickRecord?.(studentId, caseId)
          }
        />
      )}

      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onChanged={async () => {
            await load()
            onDataChanged?.()
            const next = await fetchStudentOverviewBundle(s.id)
            setBundle(next)
            setSelectedRecord(
              next.records.find((r) => r.id === selectedRecord.id) ?? null,
            )
          }}
        />
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="card">
      <button type="button" className="btn ghost dt-block-toggle" onClick={onToggle}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div style={{ marginTop: 'var(--space-3)' }}>{children}</div>}
    </section>
  )
}
