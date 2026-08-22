/**
 * Learning Profile + Consultation Summary — recompose existing data.
 * No diagnosis, risk scores, or invented facts.
 */

import { partitionFollowupsForDate } from './beforeClass'
import {
  daysBeforeISO,
  todayISO,
} from './constants'
import {
  buildPatternReport,
  resolvePatternDateRange,
  type CountItem,
  type InterventionTypeSummary,
  type PatternDateRange,
  type PatternRangePreset,
  type PatternSourceBundle,
} from './patternTracker'
import type {
  CaseRow,
  ConsultationNote,
  CurrentFocusItem,
  Followup,
  RecordRow,
  RecordType,
  Student,
  StudentVoiceEntry,
  WorkingHypothesis,
} from './types'

function countCaseOpenFollowups(caseRow: CaseRow): number {
  let n = 0
  for (const link of caseRow.case_records ?? []) {
    for (const f of link.records?.followups ?? []) {
      if (f.status === 'open') n += 1
    }
  }
  return n
}

export type StudentOverviewBundle = PatternSourceBundle & {
  student: Student
  focusItems: CurrentFocusItem[]
  voiceEntries: StudentVoiceEntry[]
  consultations: ConsultationNote[]
  messageCount: number
}

export type RecentSnapshot = {
  rangeLabel: string
  counts: CountItem[]
  importantRecords: RecordRow[]
}

export type OpenActionItem = {
  kind: 'overdue' | 'today' | 'upcoming' | 'stamp'
  title: string
  detail: string
  recordId: string
  dueDate: string | null
}

export type LearningProfileModel = {
  student: Student
  classLabel: string
  termLabel: string | null
  openFocus: CurrentFocusItem[]
  openActions: OpenActionItem[]
  activeCases: CaseRow[]
  caseMeta: Record<
    string,
    { relatedRecords: number; openFollowups: number }
  >
  positiveTagCounts: CountItem[]
  recentPositiveNotes: RecordRow[]
  recentSnapshot: RecentSnapshot
  patternTopContexts: CountItem[]
  patternTopTags: CountItem[]
  patternRangeLabel: string
  recentVoice: StudentVoiceEntry[]
  activeHypotheses: WorkingHypothesis[]
  otherHypotheses: WorkingHypothesis[]
  interventionSummaries: InterventionTypeSummary[]
  recentParentContacts: RecordRow[]
  consultations: ConsultationNote[]
  messageCount: number
  openFocusCount: number
  activeCaseCount: number
  openFollowupCount: number
  pendingStampCount: number
}

export type ConsultationSummaryModel = {
  student: Student
  classLabel: string
  range: PatternDateRange
  openFocus: CurrentFocusItem[]
  activeCases: CaseRow[]
  recentSnapshot: RecentSnapshot
  recentPositiveNotes: RecordRow[]
  recentVoice: StudentVoiceEntry[]
  activeCaseCount: number
  openFollowupCount: number
  pendingStampCount: number
  recentParentContacts: RecordRow[]
  activeHypotheses: WorkingHypothesis[]
  topContexts: CountItem[]
  consultations: ConsultationNote[]
  messageCount: number
}

function inRange(date: string, start: string | null, end: string | null): boolean {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function buildRecentSnapshot(
  records: RecordRow[],
  range: PatternDateRange,
  labelOfRecordType: (t: RecordType) => string,
): RecentSnapshot {
  const inPeriod = records.filter((r) => inRange(r.record_date, range.start, range.end))
  const keys: RecordType[] = [
    'observation',
    'guidance',
    'parent_contact',
    'positive_note',
  ]
  const counts: CountItem[] = keys.map((key) => ({
    key,
    label: labelOfRecordType(key),
    count: inPeriod.filter((r) => r.record_type === key).length,
  }))
  const important = inPeriod.filter((r) => r.is_important).length
  counts.push({ key: 'important', label: 'Important', count: important })
  const importantRecords = [...inPeriod]
    .filter((r) => r.is_important)
    .sort((a, b) => b.record_date.localeCompare(a.record_date))
    .slice(0, 5)
  return {
    rangeLabel: range.label,
    counts,
    importantRecords,
  }
}

export function getRecentPositiveEvidence(
  records: RecordRow[],
  range: PatternDateRange,
  limit = 5,
): { notes: RecordRow[]; tagCounts: CountItem[] } {
  const notes = records
    .filter(
      (r) =>
        r.record_type === 'positive_note' &&
        inRange(r.record_date, range.start, range.end),
    )
    .sort((a, b) => b.record_date.localeCompare(a.record_date))
  const tagMap = new Map<string, CountItem>()
  for (const r of notes) {
    for (const rt of r.record_tags ?? []) {
      const tag = rt.tags
      if (!tag) continue
      const cur = tagMap.get(tag.id)
      if (cur) cur.count += 1
      else tagMap.set(tag.id, { key: tag.id, label: tag.name, count: 1 })
    }
  }
  return {
    notes: notes.slice(0, limit),
    tagCounts: [...tagMap.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
  }
}

export function getRecentParentContacts(
  records: RecordRow[],
  range: PatternDateRange,
  limit = 3,
): RecordRow[] {
  return records
    .filter(
      (r) =>
        r.record_type === 'parent_contact' &&
        inRange(r.record_date, range.start, range.end),
    )
    .sort((a, b) => b.record_date.localeCompare(a.record_date))
    .slice(0, limit)
}

export function buildOpenActions(
  records: RecordRow[],
  asOf: string = todayISO(),
): OpenActionItem[] {
  const openFollowups: { followup: Followup; record: RecordRow }[] = []
  for (const r of records) {
    for (const f of r.followups ?? []) {
      if (f.status === 'open') openFollowups.push({ followup: f, record: r })
    }
  }
  const { overdue, dueToday, upcoming } = partitionFollowupsForDate(
    openFollowups.map((x) => x.followup),
    asOf,
  )
  const byId = new Map(openFollowups.map((x) => [x.followup.id, x]))
  const out: OpenActionItem[] = []
  for (const f of overdue) {
    const pair = byId.get(f.id)
    if (!pair) continue
    out.push({
      kind: 'overdue',
      title: f.note,
      detail: pair.record.content.slice(0, 60),
      recordId: pair.record.id,
      dueDate: f.due_date,
    })
  }
  for (const f of dueToday) {
    const pair = byId.get(f.id)
    if (!pair) continue
    out.push({
      kind: 'today',
      title: f.note,
      detail: pair.record.content.slice(0, 60),
      recordId: pair.record.id,
      dueDate: f.due_date,
    })
  }
  for (const f of upcoming.slice(0, 5)) {
    const pair = byId.get(f.id)
    if (!pair) continue
    out.push({
      kind: 'upcoming',
      title: f.note,
      detail: pair.record.content.slice(0, 60),
      recordId: pair.record.id,
      dueDate: f.due_date,
    })
  }
  for (const r of records.filter(
    (x) => x.record_type === 'stamp' && x.stamp_status === 'pending',
  )) {
    out.push({
      kind: 'stamp',
      title: `+${r.stamp_amount ?? 0} Stamp`,
      detail: r.content.slice(0, 60),
      recordId: r.id,
      dueDate: null,
    })
  }
  return out
}

export function buildLearningProfileModel(
  bundle: StudentOverviewBundle,
  opts: {
    classLabel: string
    labelOfRecordType: (t: RecordType) => string
    labelOfIntervention: (t: string) => string
    labelOfResponse: (t: string) => string
  },
): LearningProfileModel {
  const recent30 = resolvePatternDateRange('last_30', bundle.currentTerm)
  const termRange = resolvePatternDateRange('current_term', bundle.currentTerm)
  const patternReport = buildPatternReport(bundle, termRange, {
    labelOfIntervention: opts.labelOfIntervention,
    labelOfResponse: opts.labelOfResponse,
    labelOfRecordType: opts.labelOfRecordType,
    tagFilterType: 'observation',
  })
  const positive = getRecentPositiveEvidence(bundle.records, recent30, 5)
  const openFocus = bundle.focusItems.filter((f) => f.status === 'open')
  const openActions = buildOpenActions(bundle.records)
  const openFollowupCount = bundle.records.reduce(
    (n, r) => n + (r.followups ?? []).filter((f) => f.status === 'open').length,
    0,
  )
  const pendingStampCount = bundle.records.filter(
    (r) => r.record_type === 'stamp' && r.stamp_status === 'pending',
  ).length

  const caseMeta: LearningProfileModel['caseMeta'] = {}
  for (const c of bundle.activeCases) {
    caseMeta[c.id] = {
      relatedRecords: (c.case_records ?? []).length,
      openFollowups: countCaseOpenFollowups(c),
    }
  }

  return {
    student: bundle.student,
    classLabel: opts.classLabel,
    termLabel: bundle.currentTerm?.name ?? null,
    openFocus,
    openActions,
    activeCases: bundle.activeCases,
    caseMeta,
    positiveTagCounts: positive.tagCounts,
    recentPositiveNotes: positive.notes,
    recentSnapshot: buildRecentSnapshot(
      bundle.records,
      recent30,
      opts.labelOfRecordType,
    ),
    patternTopContexts: patternReport.contextDistribution.slice(0, 5),
    patternTopTags: patternReport.tagCounts.slice(0, 5),
    patternRangeLabel: patternReport.range.label,
    recentVoice: [...bundle.voiceEntries]
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .slice(0, 3),
    activeHypotheses: patternReport.activeHypotheses,
    otherHypotheses: patternReport.otherHypotheses,
    interventionSummaries: patternReport.interventionSummaries.slice(0, 6),
    recentParentContacts: getRecentParentContacts(bundle.records, recent30, 3),
    consultations: bundle.consultations,
    messageCount: bundle.messageCount,
    openFocusCount: openFocus.length,
    activeCaseCount: bundle.activeCases.length,
    openFollowupCount,
    pendingStampCount,
  }
}

export function buildConsultationSummaryModel(
  bundle: StudentOverviewBundle,
  preset: PatternRangePreset,
  opts: {
    classLabel: string
    labelOfRecordType: (t: RecordType) => string
  },
): ConsultationSummaryModel {
  const range = resolvePatternDateRange(preset, bundle.currentTerm)
  const patternReport = buildPatternReport(bundle, range, {
    labelOfIntervention: (t) => t,
    labelOfResponse: (t) => t,
    labelOfRecordType: opts.labelOfRecordType,
    tagFilterType: 'observation',
  })
  const positive = getRecentPositiveEvidence(bundle.records, range, 3)
  const openFocus = bundle.focusItems.filter((f) => f.status === 'open')
  const openFollowupCount = bundle.records.reduce(
    (n, r) => n + (r.followups ?? []).filter((f) => f.status === 'open').length,
    0,
  )
  const pendingStampCount = bundle.records.filter(
    (r) => r.record_type === 'stamp' && r.stamp_status === 'pending',
  ).length

  return {
    student: bundle.student,
    classLabel: opts.classLabel,
    range,
    openFocus,
    activeCases: bundle.activeCases.slice(0, 5),
    recentSnapshot: buildRecentSnapshot(
      bundle.records,
      range,
      opts.labelOfRecordType,
    ),
    recentPositiveNotes: positive.notes,
    recentVoice: [...bundle.voiceEntries]
      .filter((v) => inRange(v.recorded_at, range.start, range.end))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .slice(0, 3),
    activeCaseCount: bundle.activeCases.length,
    openFollowupCount,
    pendingStampCount,
    recentParentContacts: getRecentParentContacts(bundle.records, range, 3),
    activeHypotheses: patternReport.activeHypotheses,
    topContexts: patternReport.contextDistribution.slice(0, 4),
    consultations: bundle.consultations,
    messageCount: bundle.messageCount,
  }
}

export type ConsultationBrief = {
  focusLines: string[]
  activeCaseLines: string[]
  recentChangeLines: string[]
  positiveLines: string[]
  hypothesisLines: string[]
  openActionLines: string[]
  talkingPointHints: string[]
}

/** 20–30초 상담 직전 Brief — snippet 중심, 상세 Summary를 복제하지 않음 */
export function buildConsultationBrief(
  model: ConsultationSummaryModel,
): ConsultationBrief {
  const focusLines = model.openFocus.slice(0, 2).map((f) => f.title)

  const activeCaseLines = model.activeCases
    .slice(0, 2)
    .map((c) => c.title)

  const recentChangeLines = model.recentSnapshot.importantRecords
    .slice(0, 2)
    .map(
      (r) =>
        `${r.record_date} ${r.content.slice(0, 60)}${r.content.length > 60 ? '…' : ''}`,
    )

  const positiveLines = model.recentPositiveNotes
    .slice(0, 2)
    .map(
      (r) =>
        `${r.record_date} ${r.content.slice(0, 50)}${r.content.length > 50 ? '…' : ''}`,
    )

  const hypothesisLines = model.activeHypotheses.slice(0, 2).map((h) => {
    const conf = h.confidence ? ` · ${h.confidence}` : ''
    return `${h.hypothesis.slice(0, 70)}${h.hypothesis.length > 70 ? '…' : ''}${conf}`
  })

  const openActionLines: string[] = []
  if (model.openFollowupCount > 0) {
    openActionLines.push(`Open Follow-up ${model.openFollowupCount}`)
  }
  if (model.pendingStampCount > 0) {
    openActionLines.push(`Pending Stamp ${model.pendingStampCount}`)
  }

  const talkingPointHints: string[] = []
  if (focusLines[0]) talkingPointHints.push(`Focus: ${focusLines[0]}`)
  if (hypothesisLines[0]) talkingPointHints.push('작업 가설 확인')
  if (positiveLines[0]) talkingPointHints.push('최근 긍정 변화 공유')
  if (openActionLines[0]) talkingPointHints.push('열린 Follow-up 일정 조율')

  return {
    focusLines,
    activeCaseLines,
    recentChangeLines,
    positiveLines,
    hypothesisLines,
    openActionLines,
    talkingPointHints: talkingPointHints.slice(0, 4),
  }
}

export function buildConsultationPlainText(
  model: ConsultationSummaryModel,
): string {
  const s = model.student
  const lines: string[] = [
    `${s.korean_name}${s.english_name ? ` / ${s.english_name}` : ''}`,
    model.classLabel,
    `기간: ${model.range.label}`,
    '',
    '=== Consultation Brief ===',
  ]
  const brief = buildConsultationBrief(model)
  lines.push('[Current Focus]')
  if (brief.focusLines.length === 0) lines.push('(없음)')
  else brief.focusLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Active Case]')
  if (brief.activeCaseLines.length === 0) lines.push('(없음)')
  else brief.activeCaseLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Recent Change]')
  if (brief.recentChangeLines.length === 0) lines.push('(없음)')
  else brief.recentChangeLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Positive]')
  if (brief.positiveLines.length === 0) lines.push('(없음)')
  else brief.positiveLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Working Hypothesis]')
  if (brief.hypothesisLines.length === 0) lines.push('(없음)')
  else brief.hypothesisLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Open Action]')
  if (brief.openActionLines.length === 0) lines.push('(없음)')
  else brief.openActionLines.forEach((x) => lines.push(`• ${x}`))
  lines.push('[Talking Points]')
  if (brief.talkingPointHints.length === 0) lines.push('(없음)')
  else brief.talkingPointHints.forEach((x) => lines.push(`• ${x}`))

  lines.push('', '=== Detail ===', '', '[Current Focus]')
  if (model.openFocus.length === 0) lines.push('(없음)')
  else {
    for (const f of model.openFocus) {
      lines.push(`• ${f.title}${f.note ? ` — ${f.note}` : ''}`)
    }
  }
  lines.push('', '[Observed / Recorded]')
  for (const c of model.recentSnapshot.counts) {
    lines.push(`${c.label}: ${c.count}`)
  }
  if (model.recentSnapshot.importantRecords.length) {
    lines.push('최근 Important:')
    for (const r of model.recentSnapshot.importantRecords.slice(0, 3)) {
      lines.push(`• ${r.record_date} ${r.content.slice(0, 80)}`)
    }
  }
  lines.push('', '[Positive Evidence]')
  if (model.recentPositiveNotes.length === 0) lines.push('(없음)')
  else {
    for (const r of model.recentPositiveNotes) {
      lines.push(`• ${r.record_date} ${r.content.slice(0, 100)}`)
    }
  }
  lines.push('', '[Student Said]')
  if (model.recentVoice.length === 0) lines.push('(없음)')
  else {
    for (const v of model.recentVoice) {
      lines.push(`• ${v.recorded_at} “${v.content.slice(0, 120)}”`)
    }
  }
  lines.push('', '[Current Management]')
  lines.push(`Active Cases: ${model.activeCaseCount}`)
  lines.push(`Open Follow-ups: ${model.openFollowupCount}`)
  lines.push(`Pending Stamps: ${model.pendingStampCount}`)
  lines.push('', '[Recent Parent Contact]')
  if (model.recentParentContacts.length === 0) lines.push('(없음)')
  else {
    for (const r of model.recentParentContacts) {
      lines.push(`• ${r.record_date} ${r.content.slice(0, 100)}`)
    }
  }
  lines.push('', '[Teacher Working Hypothesis]')
  lines.push('(교사의 해석이며 확정된 사실이 아닙니다)')
  if (model.activeHypotheses.length === 0) lines.push('(없음)')
  else {
    for (const h of model.activeHypotheses) {
      lines.push(
        `• ${h.hypothesis} (Confidence: ${h.confidence}, Evidence ${(h.hypothesis_records ?? []).length})`,
      )
    }
  }
  if (model.topContexts.length) {
    lines.push('', '[주요 Context]')
    for (const c of model.topContexts) {
      lines.push(`${c.label}: ${c.count}`)
    }
  }
  return lines.join('\n')
}

/** Fallback recent-30 range when term unavailable — used by callers for empty states */
export function defaultRecent30Range(currentTerm: PatternSourceBundle['currentTerm']) {
  return resolvePatternDateRange('last_30', currentTerm)
}

export function daysBeforeFromToday(days: number): string {
  return daysBeforeISO(todayISO(), days)
}
