/**
 * Pattern Tracker — descriptive aggregations only.
 * No diagnosis, risk scores, effectiveness %, or auto-hypothesis.
 */

import {
  daysBeforeISO,
  daysBetweenISO,
  todayISO,
} from './constants'
import type {
  AbcObservation,
  CaseRow,
  ContextTag,
  Intervention,
  ParentManagementStatus,
  RecordRow,
  RecordType,
  TermRow,
  WorkingHypothesis,
} from './types'

export type PatternRangePreset =
  | 'last_30'
  | 'last_90'
  | 'current_term'
  | 'all'
  | 'custom'

export type PatternDateRange = {
  preset: PatternRangePreset
  start: string | null
  end: string | null
  label: string
}

export type CountItem = {
  key: string
  label: string
  count: number
}

export type CrossTabCell = {
  contextKey: string
  contextLabel: string
  tagKey: string
  tagLabel: string
  count: number
}

export type TimeTrendBucket = {
  key: string
  label: string
  count: number
}

export type AbcListItem = {
  abc: AbcObservation
  recordDate: string
  recordId: string
  contexts: CountItem[]
  behaviorSnippet: string
  consequenceSnippet: string
}

export type InterventionTypeSummary = {
  type: string
  label: string
  interventionCount: number
  responseCount: number
  responsesByType: CountItem[]
  interventions: Intervention[]
}

export type PatternReport = {
  range: PatternDateRange
  recordDensity: CountItem[]
  contextDistribution: CountItem[]
  tagCounts: CountItem[]
  crossTab: CrossTabCell[]
  abcCount: number
  recentAbcs: AbcListItem[]
  interventionSummaries: InterventionTypeSummary[]
  timeTrend: TimeTrendBucket[]
  timeTrendMode: 'week' | 'month'
  positiveTagCounts: CountItem[]
  recentPositiveNotes: RecordRow[]
  activeHypotheses: WorkingHypothesis[]
  otherHypotheses: WorkingHypothesis[]
  activeCases: CaseRow[]
  managementStatus: ParentManagementStatus | null
}

export type PatternSourceBundle = {
  studentId: string
  managementStatus: ParentManagementStatus | null
  records: RecordRow[]
  /** Observation record_id → context tags */
  contextsByRecordId: Record<string, ContextTag[]>
  abcs: AbcObservation[]
  interventions: Intervention[]
  hypotheses: WorkingHypothesis[]
  activeCases: CaseRow[]
  currentTerm: TermRow | null
}

export type PatternProfileSnapshot = {
  rangeLabel: string
  observationCount: number
  contextLinkCount: number
  interventionCount: number
  responseCount: number
  topContexts: CountItem[]
  topTags: CountItem[]
}

function inRange(
  date: string,
  start: string | null,
  end: string | null,
): boolean {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function resolvePatternDateRange(
  preset: PatternRangePreset,
  currentTerm: TermRow | null,
  custom?: { start: string; end: string },
  asOf: string = todayISO(),
): PatternDateRange {
  if (preset === 'last_30') {
    return {
      preset,
      start: daysBeforeISO(asOf, 29),
      end: asOf,
      label: '최근 30일',
    }
  }
  if (preset === 'last_90') {
    return {
      preset,
      start: daysBeforeISO(asOf, 89),
      end: asOf,
      label: '최근 90일',
    }
  }
  if (preset === 'current_term') {
    if (currentTerm) {
      return {
        preset,
        start: currentTerm.start_date,
        end: currentTerm.end_date && currentTerm.end_date < asOf
          ? currentTerm.end_date
          : asOf,
        label: `현재 학기 (${currentTerm.name})`,
      }
    }
    return {
      preset: 'last_90',
      start: daysBeforeISO(asOf, 89),
      end: asOf,
      label: '최근 90일 (학기 없음)',
    }
  }
  if (preset === 'custom' && custom?.start && custom?.end) {
    const start = custom.start <= custom.end ? custom.start : custom.end
    const end = custom.start <= custom.end ? custom.end : custom.start
    return {
      preset,
      start,
      end,
      label: `사용자 지정 ${start} ~ ${end}`,
    }
  }
  return {
    preset: 'all',
    start: null,
    end: null,
    label: '전체 기간',
  }
}

function sortCounts(items: CountItem[]): CountItem[] {
  return [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function bump(
  map: Map<string, CountItem>,
  key: string,
  label: string,
  by = 1,
) {
  const cur = map.get(key)
  if (cur) cur.count += by
  else map.set(key, { key, label, count: by })
}

export function countByContext(
  observations: RecordRow[],
  contextsByRecordId: Record<string, ContextTag[]>,
): CountItem[] {
  const map = new Map<string, CountItem>()
  for (const r of observations) {
    for (const t of contextsByRecordId[r.id] ?? []) {
      bump(map, t.id, t.label)
    }
  }
  return sortCounts([...map.values()])
}

export function countByTag(
  records: RecordRow[],
): CountItem[] {
  const map = new Map<string, CountItem>()
  for (const r of records) {
    for (const rt of r.record_tags ?? []) {
      const tag = rt.tags
      if (!tag) continue
      bump(map, tag.id, tag.name)
    }
  }
  return sortCounts([...map.values()])
}

export function buildContextTagCrossTab(
  observations: RecordRow[],
  contextsByRecordId: Record<string, ContextTag[]>,
): CrossTabCell[] {
  const map = new Map<string, CrossTabCell>()
  for (const r of observations) {
    const contexts = contextsByRecordId[r.id] ?? []
    const tags = (r.record_tags ?? [])
      .map((rt) => rt.tags)
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
    for (const c of contexts) {
      for (const t of tags) {
        const key = `${c.id}::${t.id}`
        const cur = map.get(key)
        if (cur) cur.count += 1
        else {
          map.set(key, {
            contextKey: c.id,
            contextLabel: c.label,
            tagKey: t.id,
            tagLabel: t.name,
            count: 1,
          })
        }
      }
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.contextLabel.localeCompare(b.contextLabel) ||
      a.tagLabel.localeCompare(b.tagLabel),
  )
}

export function countInterventionTypes(
  interventions: Intervention[],
  labelOfType: (type: string) => string,
): CountItem[] {
  const map = new Map<string, CountItem>()
  for (const i of interventions) {
    bump(map, i.intervention_type, labelOfType(i.intervention_type))
  }
  return sortCounts([...map.values()])
}

export function countResponsesByInterventionType(
  interventions: Intervention[],
  labelOfType: (type: string) => string,
  labelOfResponse: (type: string) => string,
): InterventionTypeSummary[] {
  const byType = new Map<string, Intervention[]>()
  for (const i of interventions) {
    const list = byType.get(i.intervention_type) ?? []
    list.push(i)
    byType.set(i.intervention_type, list)
  }
  const out: InterventionTypeSummary[] = []
  for (const [type, list] of byType) {
    const responseMap = new Map<string, CountItem>()
    let responseCount = 0
    for (const i of list) {
      for (const r of i.intervention_responses ?? []) {
        responseCount += 1
        const key = r.response_type ?? 'unspecified'
        const label =
          r.response_type == null
            ? '미지정'
            : labelOfResponse(r.response_type)
        bump(responseMap, key, label)
      }
    }
    out.push({
      type,
      label: labelOfType(type),
      interventionCount: list.length,
      responseCount,
      responsesByType: sortCounts([...responseMap.values()]),
      interventions: [...list].sort((a, b) =>
        b.applied_at.localeCompare(a.applied_at),
      ),
    })
  }
  return out.sort((a, b) => b.interventionCount - a.interventionCount)
}

function weekStartISO(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = (dt.getDay() + 6) % 7 // Mon=0
  dt.setDate(dt.getDate() - day)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function buildTimeTrend(
  records: RecordRow[],
  range: PatternDateRange,
): { buckets: TimeTrendBucket[]; mode: 'week' | 'month' } {
  const start = range.start
  const end = range.end ?? todayISO()
  const span =
    start && end ? daysBetweenISO(start, end) : Number.POSITIVE_INFINITY
  const mode: 'week' | 'month' = span <= 90 ? 'week' : 'month'
  const map = new Map<string, number>()
  for (const r of records) {
    const key = mode === 'week' ? weekStartISO(r.record_date) : monthKey(r.record_date)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const keys = [...map.keys()].sort()
  const buckets = keys.map((key) => ({
    key,
    label:
      mode === 'week'
        ? `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}주`
        : `${Number(key.slice(5, 7))}월`,
    count: map.get(key) ?? 0,
  }))
  return { buckets, mode }
}

function snippet(text: string | null | undefined, max = 80): string {
  if (!text) return '—'
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function buildPatternReport(
  bundle: PatternSourceBundle,
  range: PatternDateRange,
  opts: {
    labelOfIntervention: (type: string) => string
    labelOfResponse: (type: string) => string
    labelOfRecordType: (type: RecordType) => string
    tagFilterType?: RecordType | 'all'
  },
): PatternReport {
  const recordsInRange = bundle.records.filter((r) =>
    inRange(r.record_date, range.start, range.end),
  )
  const observations = recordsInRange.filter((r) => r.record_type === 'observation')
  const positives = recordsInRange.filter((r) => r.record_type === 'positive_note')

  const densityMap = new Map<string, CountItem>()
  for (const r of recordsInRange) {
    bump(
      densityMap,
      r.record_type,
      opts.labelOfRecordType(r.record_type),
    )
  }

  const tagSource =
    opts.tagFilterType && opts.tagFilterType !== 'all'
      ? recordsInRange.filter((r) => r.record_type === opts.tagFilterType)
      : observations

  const abcsInRange = bundle.abcs.filter((a) => {
    const rec = bundle.records.find((r) => r.id === a.record_id)
    const date = rec?.record_date
    return date ? inRange(date, range.start, range.end) : false
  })

  const recentAbcs: AbcListItem[] = [...abcsInRange]
    .map((abc) => {
      const rec = bundle.records.find((r) => r.id === abc.record_id)
      const contexts = (bundle.contextsByRecordId[abc.record_id] ?? []).map(
        (t) => ({ key: t.id, label: t.label, count: 1 }),
      )
      return {
        abc,
        recordDate: rec?.record_date ?? '',
        recordId: abc.record_id,
        contexts,
        behaviorSnippet: snippet(abc.behavior),
        consequenceSnippet: snippet(abc.consequence),
      }
    })
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
    .slice(0, 8)

  const interventionsInRange = bundle.interventions.filter((i) =>
    inRange(i.applied_at, range.start, range.end),
  )

  const { buckets, mode } = buildTimeTrend(observations, range)

  const activeHypotheses = bundle.hypotheses.filter((h) => h.status === 'active')
  const otherHypotheses = bundle.hypotheses.filter((h) => h.status !== 'active')

  return {
    range,
    recordDensity: sortCounts([...densityMap.values()]),
    contextDistribution: countByContext(observations, bundle.contextsByRecordId),
    tagCounts: countByTag(tagSource),
    crossTab: buildContextTagCrossTab(observations, bundle.contextsByRecordId),
    abcCount: abcsInRange.length,
    recentAbcs,
    interventionSummaries: countResponsesByInterventionType(
      interventionsInRange,
      opts.labelOfIntervention,
      opts.labelOfResponse,
    ),
    timeTrend: buckets,
    timeTrendMode: mode,
    positiveTagCounts: countByTag(positives),
    recentPositiveNotes: [...positives]
      .sort((a, b) => b.record_date.localeCompare(a.record_date))
      .slice(0, 3),
    activeHypotheses,
    otherHypotheses,
    activeCases: bundle.activeCases,
    managementStatus: bundle.managementStatus,
  }
}

export function buildPatternProfileSnapshot(
  bundle: PatternSourceBundle,
  range: PatternDateRange,
): PatternProfileSnapshot {
  const report = buildPatternReport(bundle, range, {
    labelOfIntervention: (t) => t,
    labelOfResponse: (t) => t,
    labelOfRecordType: (t) => t,
    tagFilterType: 'observation',
  })
  const responseCount = report.interventionSummaries.reduce(
    (n, s) => n + s.responseCount,
    0,
  )
  const contextLinkCount = report.contextDistribution.reduce(
    (n, c) => n + c.count,
    0,
  )
  return {
    rangeLabel: range.label,
    observationCount:
      report.recordDensity.find((d) => d.key === 'observation')?.count ?? 0,
    contextLinkCount,
    interventionCount: report.interventionSummaries.reduce(
      (n, s) => n + s.interventionCount,
      0,
    ),
    responseCount,
    topContexts: report.contextDistribution.slice(0, 3),
    topTags: report.tagCounts.slice(0, 3),
  }
}
