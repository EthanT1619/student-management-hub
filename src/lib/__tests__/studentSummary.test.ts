import { describe, expect, it } from 'vitest'
import type { PatternDateRange, PatternSourceBundle } from '../patternTracker'
import {
  buildConsultationBrief,
  buildConsultationSummaryModel,
  buildOpenActions,
  buildRecentSnapshot,
  getRecentParentContacts,
  getRecentPositiveEvidence,
  type StudentOverviewBundle,
} from '../studentSummary'
import type {
  CurrentFocusItem,
  RecordRow,
  Student,
  StudentVoiceEntry,
  WorkingHypothesis,
} from '../types'

const RANGE: PatternDateRange = {
  preset: 'custom',
  start: '2024-07-01',
  end: '2024-07-31',
  label: 'July',
}

function student(): Student {
  return {
    id: 's1',
    korean_name: '김학생',
    english_name: 'Kim',
    class_id: 'class-1',
    accent_color: null,
    enrollment_status: 'active',
    parent_management_status: 'stable',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function record(
  partial: Partial<RecordRow> &
    Pick<RecordRow, 'id' | 'record_date' | 'record_type' | 'content'>,
): RecordRow {
  return {
    student_id: 's1',
    is_important: false,
    contact_method: null,
    stamp_amount: null,
    stamp_status: null,
    stamp_given_at: null,
    created_by: null,
    created_at: `${partial.record_date}T12:00:00Z`,
    updated_at: `${partial.record_date}T12:00:00Z`,
    followups: [],
    ...partial,
  }
}

const labelOfRecordType = (t: string) => t

describe('buildRecentSnapshot', () => {
  it('counts record types in range and lists important records', () => {
    const records = [
      record({ id: 'o1', record_date: '2024-07-10', record_type: 'observation', content: 'obs' }),
      record({
        id: 'imp',
        record_date: '2024-07-12',
        record_type: 'guidance',
        content: 'important guidance',
        is_important: true,
      }),
      record({
        id: 'out',
        record_date: '2024-06-01',
        record_type: 'observation',
        content: 'out of range',
        is_important: true,
      }),
      record({
        id: 'pos',
        record_date: '2024-07-15',
        record_type: 'positive_note',
        content: 'good',
      }),
    ]
    const snap = buildRecentSnapshot(records, RANGE, labelOfRecordType)
    expect(snap.rangeLabel).toBe('July')
    expect(snap.counts.find((c) => c.key === 'observation')?.count).toBe(1)
    expect(snap.counts.find((c) => c.key === 'guidance')?.count).toBe(1)
    expect(snap.counts.find((c) => c.key === 'positive_note')?.count).toBe(1)
    expect(snap.counts.find((c) => c.key === 'important')?.count).toBe(1)
    expect(snap.importantRecords.map((r) => r.id)).toEqual(['imp'])
  })
})

describe('getRecentPositiveEvidence', () => {
  it('returns positive notes and tag counts within range', () => {
    const records = [
      record({
        id: 'p1',
        record_date: '2024-07-20',
        record_type: 'positive_note',
        content: 'newer',
        record_tags: [
          {
            tag_id: 't1',
            tags: {
              id: 't1',
              name: 'Effort',
              category: 'academic',
              sort_order: 0,
              is_active: true,
            },
          },
        ],
      }),
      record({
        id: 'p0',
        record_date: '2024-07-05',
        record_type: 'positive_note',
        content: 'older',
        record_tags: [
          {
            tag_id: 't1',
            tags: {
              id: 't1',
              name: 'Effort',
              category: 'academic',
              sort_order: 0,
              is_active: true,
            },
          },
        ],
      }),
      record({
        id: 'p-out',
        record_date: '2024-05-01',
        record_type: 'positive_note',
        content: 'excluded',
      }),
    ]
    const { notes, tagCounts } = getRecentPositiveEvidence(records, RANGE, 5)
    expect(notes.map((n) => n.id)).toEqual(['p1', 'p0'])
    expect(tagCounts).toEqual([{ key: 't1', label: 'Effort', count: 2 }])
  })
})

describe('getRecentParentContacts', () => {
  it('returns newest parent contacts in range up to limit', () => {
    const records = [
      record({
        id: 'c1',
        record_date: '2024-07-01',
        record_type: 'parent_contact',
        content: 'first',
        contact_method: 'phone',
      }),
      record({
        id: 'c2',
        record_date: '2024-07-20',
        record_type: 'parent_contact',
        content: 'second',
        contact_method: 'message',
      }),
      record({
        id: 'c3',
        record_date: '2024-07-25',
        record_type: 'parent_contact',
        content: 'third',
        contact_method: 'phone',
      }),
    ]
    expect(getRecentParentContacts(records, RANGE, 2).map((r) => r.id)).toEqual([
      'c3',
      'c2',
    ])
  })
})

describe('buildOpenActions', () => {
  it('builds overdue / today / upcoming followups and pending stamps', () => {
    const asOf = '2024-07-15'
    const records = [
      record({
        id: 'r1',
        record_date: '2024-07-01',
        record_type: 'observation',
        content: 'obs content long enough',
        followups: [
          {
            id: 'f-overdue',
            record_id: 'r1',
            due_date: '2024-07-10',
            note: 'Overdue FU',
            status: 'open',
            completed_at: null,
            created_at: '2024-07-01T00:00:00Z',
            updated_at: '2024-07-01T00:00:00Z',
          },
          {
            id: 'f-today',
            record_id: 'r1',
            due_date: '2024-07-15',
            note: 'Today FU',
            status: 'open',
            completed_at: null,
            created_at: '2024-07-01T00:00:00Z',
            updated_at: '2024-07-01T00:00:00Z',
          },
          {
            id: 'f-up',
            record_id: 'r1',
            due_date: '2024-07-20',
            note: 'Upcoming FU',
            status: 'open',
            completed_at: null,
            created_at: '2024-07-01T00:00:00Z',
            updated_at: '2024-07-01T00:00:00Z',
          },
        ],
      }),
      record({
        id: 'stamp1',
        record_date: '2024-07-14',
        record_type: 'stamp',
        content: 'pending stamp note',
        stamp_amount: 2,
        stamp_status: 'pending',
      }),
    ]
    const actions = buildOpenActions(records, asOf)
    expect(actions.map((a) => a.kind)).toEqual([
      'overdue',
      'today',
      'upcoming',
      'stamp',
    ])
    expect(actions.find((a) => a.kind === 'stamp')?.title).toBe('+2 Stamp')
  })
})

describe('buildConsultationBrief / Voice vs Hypothesis', () => {
  function baseBundle(
    overrides: Partial<StudentOverviewBundle> = {},
  ): StudentOverviewBundle {
    const empty: PatternSourceBundle = {
      studentId: 's1',
      managementStatus: 'stable',
      records: [],
      contextsByRecordId: {},
      abcs: [],
      interventions: [],
      hypotheses: [],
      activeCases: [],
      currentTerm: {
        id: 'term-1',
        name: 'Summer',
        start_date: '2024-06-01',
        end_date: '2024-08-31',
        is_current: true,
      },
    }
    return {
      ...empty,
      student: student(),
      focusItems: [],
      voiceEntries: [],
      consultations: [],
      messageCount: 0,
      ...overrides,
    }
  }

  it('builds brief lines from consultation summary model', () => {
    const focus: CurrentFocusItem = {
      id: 'f1',
      student_id: 's1',
      title: '숙제 루틴',
      note: 'note',
      tag_id: null,
      status: 'open',
      sort_order: 0,
      created_at: '2024-07-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z',
      completed_at: null,
    }
    const hypothesis: WorkingHypothesis = {
      id: 'h1',
      student_id: 's1',
      case_id: null,
      hypothesis: '과제 부담이 참여를 낮출 수 있다',
      confidence: 'medium',
      status: 'active',
      needs_more_observation: false,
      status_note: null,
      created_by: null,
      created_at: '2024-07-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z',
      resolved_at: null,
    }
    const model = {
      student: student(),
      classLabel: 'A반',
      range: RANGE,
      openFocus: [focus],
      activeCases: [
        {
          id: 'case1',
          student_id: 's1',
          title: '숙제 Case',
          case_type: 'homework' as const,
          status: 'open' as const,
          priority: 'normal' as const,
          summary: null,
          goal: null,
          opened_at: '2024-07-01',
          closed_at: null,
          outcome: null,
          created_by: null,
          created_at: '2024-07-01T00:00:00Z',
          updated_at: '2024-07-01T00:00:00Z',
        },
      ],
      recentSnapshot: {
        rangeLabel: 'July',
        counts: [],
        importantRecords: [
          record({
            id: 'imp',
            record_date: '2024-07-12',
            record_type: 'guidance',
            content: 'important change noted in class',
            is_important: true,
          }),
        ],
      },
      recentPositiveNotes: [
        record({
          id: 'pos',
          record_date: '2024-07-15',
          record_type: 'positive_note',
          content: '참여 좋아짐',
        }),
      ],
      recentVoice: [],
      activeCaseCount: 1,
      openFollowupCount: 2,
      pendingStampCount: 1,
      recentParentContacts: [],
      activeHypotheses: [hypothesis],
      topContexts: [],
      consultations: [],
      messageCount: 0,
    }
    const brief = buildConsultationBrief(model)
    expect(brief.focusLines).toEqual(['숙제 루틴'])
    expect(brief.activeCaseLines).toEqual(['숙제 Case'])
    expect(brief.hypothesisLines[0]).toContain('과제 부담이 참여를 낮출 수 있다')
    expect(brief.hypothesisLines[0]).toContain('medium')
    expect(brief.openActionLines).toEqual([
      'Open Follow-up 2',
      'Pending Stamp 1',
    ])
    expect(brief.talkingPointHints.length).toBeGreaterThan(0)
  })

  it('keeps Student Voice and Working Hypothesis as separate fields', () => {
    const voice: StudentVoiceEntry = {
      id: 'v1',
      student_id: 's1',
      record_id: null,
      case_id: null,
      content: '나는 수학이 어려워요',
      recorded_at: '2024-07-10',
      created_by: null,
      created_at: '2024-07-10T00:00:00Z',
      updated_at: '2024-07-10T00:00:00Z',
    }
    const hypothesis: WorkingHypothesis = {
      id: 'h1',
      student_id: 's1',
      case_id: null,
      hypothesis: '기초 연산 부담이 회피를 유발할 수 있다',
      confidence: 'low',
      status: 'active',
      needs_more_observation: true,
      status_note: null,
      created_by: null,
      created_at: '2024-07-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z',
      resolved_at: null,
    }
    // preset 'all' avoids todayISO() coupling so fixtures stay deterministic
    const model = buildConsultationSummaryModel(
      baseBundle({
        voiceEntries: [voice],
        hypotheses: [hypothesis],
        records: [
          record({
            id: 'r1',
            record_date: '2024-07-10',
            record_type: 'observation',
            content: 'obs',
          }),
        ],
      }),
      'all',
      {
        classLabel: 'A반',
        labelOfRecordType,
      },
    )
    expect(model.recentVoice.map((v) => v.content)).toEqual(['나는 수학이 어려워요'])
    expect(model.activeHypotheses.map((h) => h.hypothesis)).toEqual([
      '기초 연산 부담이 회피를 유발할 수 있다',
    ])
    expect(model.recentVoice[0]?.id).not.toBe(model.activeHypotheses[0]?.id)
  })
})
