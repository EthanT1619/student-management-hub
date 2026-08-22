import { describe, expect, it } from 'vitest'
import {
  buildContextTagCrossTab,
  buildPatternReport,
  countByContext,
  countByTag,
  countInterventionTypes,
  countResponsesByInterventionType,
  resolvePatternDateRange,
  type PatternSourceBundle,
} from '../patternTracker'
import type {
  ContextTag,
  Intervention,
  RecordRow,
  Tag,
  TermRow,
} from '../types'

function tag(id: string, name: string): Tag {
  return {
    id,
    name,
    category: 'academic',
    sort_order: 0,
    is_active: true,
  }
}

function context(id: string, label: string): ContextTag {
  return {
    id,
    code: id,
    label,
    sort_order: 0,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  }
}

function observation(
  id: string,
  date: string,
  tags: Tag[] = [],
): RecordRow {
  return {
    id,
    student_id: 's1',
    record_date: date,
    record_type: 'observation',
    content: `obs ${id}`,
    is_important: false,
    contact_method: null,
    stamp_amount: null,
    stamp_status: null,
    stamp_given_at: null,
    created_by: null,
    created_at: `${date}T12:00:00Z`,
    updated_at: `${date}T12:00:00Z`,
    record_tags: tags.map((t) => ({ tag_id: t.id, tags: t })),
  }
}

function intervention(
  partial: Partial<Intervention> &
    Pick<Intervention, 'id' | 'intervention_type' | 'applied_at'>,
): Intervention {
  return {
    student_id: 's1',
    record_id: null,
    case_id: null,
    description: 'desc',
    target: null,
    created_by: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    intervention_responses: [],
    ...partial,
  }
}

const labelOfType = (t: string) => `L:${t}`
const labelOfResponse = (t: string) => `R:${t}`

describe('countByContext', () => {
  it('aggregates context tags across observations', () => {
    const ctxA = context('c1', 'Group')
    const ctxB = context('c2', '1:1')
    const observations = [
      observation('r1', '2024-06-01'),
      observation('r2', '2024-06-02'),
      observation('r3', '2024-06-03'),
    ]
    const byRecord = {
      r1: [ctxA],
      r2: [ctxA, ctxB],
      r3: [ctxB],
    }
    const counts = countByContext(observations, byRecord)
    // equal counts sort by label ascending
    expect(counts).toEqual([
      { key: 'c2', label: '1:1', count: 2 },
      { key: 'c1', label: 'Group', count: 2 },
    ])
  })
})

describe('countByTag', () => {
  it('counts nested record tags and sorts by frequency', () => {
    const focus = tag('t1', 'Focus')
    const hw = tag('t2', 'HW')
    const records = [
      observation('r1', '2024-06-01', [focus, hw]),
      observation('r2', '2024-06-02', [focus]),
    ]
    expect(countByTag(records)).toEqual([
      { key: 't1', label: 'Focus', count: 2 },
      { key: 't2', label: 'HW', count: 1 },
    ])
  })
})

describe('buildContextTagCrossTab', () => {
  it('cross-tabs each context × tag pair on the same observation', () => {
    const ctx = context('c1', 'Group')
    const focus = tag('t1', 'Focus')
    const hw = tag('t2', 'HW')
    const observations = [observation('r1', '2024-06-01', [focus, hw])]
    const cells = buildContextTagCrossTab(observations, { r1: [ctx] })
    expect(cells).toHaveLength(2)
    expect(cells.map((c) => `${c.contextLabel}|${c.tagLabel}|${c.count}`).sort()).toEqual([
      'Group|Focus|1',
      'Group|HW|1',
    ])
  })
})

describe('countInterventionTypes / countResponsesByInterventionType', () => {
  const interventions = [
    intervention({
      id: 'i1',
      intervention_type: 'prompting',
      applied_at: '2024-06-10',
      intervention_responses: [
        {
          id: 'rr1',
          intervention_id: 'i1',
          response_date: '2024-06-11',
          response: 'ok',
          response_type: 'positive',
          created_at: '2024-06-11T00:00:00Z',
          updated_at: '2024-06-11T00:00:00Z',
        },
      ],
    }),
    intervention({
      id: 'i2',
      intervention_type: 'prompting',
      applied_at: '2024-06-12',
      intervention_responses: [
        {
          id: 'rr2',
          intervention_id: 'i2',
          response_date: '2024-06-13',
          response: 'meh',
          response_type: 'neutral',
          created_at: '2024-06-13T00:00:00Z',
          updated_at: '2024-06-13T00:00:00Z',
        },
      ],
    }),
    intervention({
      id: 'i3',
      intervention_type: 'modeling',
      applied_at: '2024-06-14',
    }),
  ]

  it('counts intervention types', () => {
    expect(countInterventionTypes(interventions, labelOfType)).toEqual([
      { key: 'prompting', label: 'L:prompting', count: 2 },
      { key: 'modeling', label: 'L:modeling', count: 1 },
    ])
  })

  it('aggregates responses by intervention type', () => {
    const summaries = countResponsesByInterventionType(
      interventions,
      labelOfType,
      labelOfResponse,
    )
    const prompting = summaries.find((s) => s.type === 'prompting')
    expect(prompting?.interventionCount).toBe(2)
    expect(prompting?.responseCount).toBe(2)
    expect(prompting?.responsesByType).toEqual([
      { key: 'neutral', label: 'R:neutral', count: 1 },
      { key: 'positive', label: 'R:positive', count: 1 },
    ])
    const modeling = summaries.find((s) => s.type === 'modeling')
    expect(modeling?.responseCount).toBe(0)
  })
})

describe('resolvePatternDateRange / date filtering isolation', () => {
  const term: TermRow = {
    id: 'term-1',
    name: '2024 Summer',
    start_date: '2024-06-01',
    end_date: '2024-08-31',
    is_current: true,
  }

  it('resolves last_30 / last_90 / all / custom / current_term', () => {
    const asOf = '2024-08-15'
    expect(resolvePatternDateRange('last_30', term, undefined, asOf)).toMatchObject({
      preset: 'last_30',
      start: '2024-07-17',
      end: asOf,
    })
    expect(resolvePatternDateRange('last_90', term, undefined, asOf)).toMatchObject({
      preset: 'last_90',
      start: '2024-05-18',
      end: asOf,
    })
    expect(resolvePatternDateRange('all', term, undefined, asOf)).toMatchObject({
      preset: 'all',
      start: null,
      end: null,
    })
    expect(
      resolvePatternDateRange('custom', term, { start: '2024-07-01', end: '2024-07-10' }, asOf),
    ).toMatchObject({
      preset: 'custom',
      start: '2024-07-01',
      end: '2024-07-10',
    })
    expect(resolvePatternDateRange('current_term', term, undefined, asOf)).toMatchObject({
      preset: 'current_term',
      start: '2024-06-01',
      end: asOf,
    })
  })

  it('isolates records outside the resolved range in buildPatternReport', () => {
    const inRange = observation('in', '2024-07-20', [tag('t1', 'Focus')])
    const outRange = observation('out', '2024-05-01', [tag('t1', 'Focus')])
    const bundle: PatternSourceBundle = {
      studentId: 's1',
      managementStatus: 'stable',
      records: [inRange, outRange],
      contextsByRecordId: {
        in: [context('c1', 'Group')],
        out: [context('c1', 'Group')],
      },
      abcs: [],
      interventions: [
        intervention({ id: 'i-in', intervention_type: 'prompting', applied_at: '2024-07-20' }),
        intervention({ id: 'i-out', intervention_type: 'prompting', applied_at: '2024-05-01' }),
      ],
      hypotheses: [],
      activeCases: [],
      currentTerm: term,
    }
    const range = resolvePatternDateRange('last_30', term, undefined, '2024-08-15')
    const report = buildPatternReport(bundle, range, {
      labelOfIntervention: labelOfType,
      labelOfResponse: labelOfResponse,
      labelOfRecordType: (t) => t,
    })
    expect(report.recordDensity.find((d) => d.key === 'observation')?.count).toBe(1)
    expect(report.contextDistribution[0]?.count).toBe(1)
    expect(report.tagCounts[0]?.count).toBe(1)
    expect(report.interventionSummaries[0]?.interventionCount).toBe(1)
  })
})
