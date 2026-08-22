import { describe, expect, it } from 'vitest'
import {
  REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS,
  REVIEW_PARENT_CONTACT_WITHOUT_FOLLOWUP_DAYS,
  REVIEW_STALE_FOCUS_DAYS,
  REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS,
  daysBeforeISO,
} from '../constants'
import {
  computeReviewItems,
  filterActiveReviews,
  isReviewHiddenByAction,
  type ReviewActionRow,
  type ReviewItem,
} from '../reviewQueue'
import type { CurrentFocusItem, Followup, RecordRow, Student } from '../types'

const AS_OF = '2024-08-15'
const CLASS_ID = 'class-1'

function student(partial: Partial<Student> & Pick<Student, 'id' | 'korean_name'>): Student {
  return {
    english_name: null,
    class_id: CLASS_ID,
    accent_color: null,
    enrollment_status: 'active',
    parent_management_status: 'stable',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...partial,
  }
}

function focus(
  partial: Partial<CurrentFocusItem> & Pick<CurrentFocusItem, 'id' | 'created_at'>,
): CurrentFocusItem {
  return {
    student_id: 's1',
    title: 'Focus title',
    note: null,
    tag_id: null,
    status: 'open',
    sort_order: 0,
    updated_at: partial.created_at,
    completed_at: null,
    ...partial,
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

function openFollowup(id: string): Followup {
  return {
    id,
    record_id: 'r1',
    due_date: '2024-08-20',
    note: 'follow',
    status: 'open',
    completed_at: null,
    created_at: '2024-08-01T00:00:00Z',
    updated_at: '2024-08-01T00:00:00Z',
  }
}

function computeFor(input: {
  students?: Student[]
  focusByStudent?: Map<string, CurrentFocusItem[]>
  recordsByStudent?: Map<string, RecordRow[]>
  classStartByStudent?: Map<string, string | null>
}) {
  const students = input.students ?? [student({ id: 's1', korean_name: '김학생' })]
  return computeReviewItems({
    students,
    focusByStudent: input.focusByStudent ?? new Map(),
    recordsByStudent: input.recordsByStudent ?? new Map(),
    classStartByStudent: input.classStartByStudent ?? new Map([['s1', '2024-01-01']]),
    asOfDate: AS_OF,
    currentTermClassIds: new Set([CLASS_ID]),
  })
}

describe('computeReviewItems', () => {
  it('flags stale focus at or beyond threshold', () => {
    const staleDate = daysBeforeISO(AS_OF, REVIEW_STALE_FOCUS_DAYS)
    const freshDate = daysBeforeISO(AS_OF, REVIEW_STALE_FOCUS_DAYS - 1)
    const items = computeFor({
      focusByStudent: new Map([
        [
          's1',
          [
            focus({ id: 'f-stale', created_at: `${staleDate}T09:00:00` }),
            focus({ id: 'f-fresh', created_at: `${freshDate}T09:00:00` }),
            focus({ id: 'f-done', created_at: `${staleDate}T09:00:00`, status: 'done' }),
          ],
        ],
      ]),
      // recent record so no "without recent record" item
      recordsByStudent: new Map([
        ['s1', [record({ id: 'r-recent', record_date: AS_OF, record_type: 'observation', content: 'ok' })]],
      ]),
    })
    const stale = items.filter((i) => i.ruleType === 'stale_focus')
    expect(stale).toHaveLength(1)
    expect(stale[0].sourceId).toBe('f-stale')
    expect(stale[0].ageDays).toBe(REVIEW_STALE_FOCUS_DAYS)
  })

  it('flags observation without followup; subsequent management clears earlier obs', () => {
    const gapDate = daysBeforeISO(AS_OF, REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS)
    const clearedDate = daysBeforeISO(AS_OF, REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS + 10)
    const guidanceDate = daysBeforeISO(AS_OF, REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS + 5)
    const items = computeFor({
      recordsByStudent: new Map([
        [
          's1',
          [
            record({
              id: 'obs-gap',
              record_date: gapDate,
              record_type: 'observation',
              content: 'old obs with no follow-through',
            }),
            record({
              id: 'obs-cleared',
              record_date: clearedDate,
              record_type: 'observation',
              content: 'cleared by later guidance',
            }),
            record({
              id: 'guidance-later',
              record_date: guidanceDate,
              record_type: 'guidance',
              content: 'follow-through',
            }),
            // keep student off the "no recent record" rule (stamp is not management follow-through)
            record({
              id: 'r-recent',
              record_date: AS_OF,
              record_type: 'stamp',
              content: 'recent stamp',
              stamp_amount: 1,
              stamp_status: 'given',
            }),
          ],
        ],
      ]),
    })
    const obs = items.filter((i) => i.ruleType === 'observation_without_followup')
    expect(obs.map((i) => i.sourceId)).toEqual(['obs-gap'])
  })

  it('does not duplicate observation as gap when explicit open followup exists', () => {
    const oldObsDate = daysBeforeISO(AS_OF, REVIEW_OBSERVATION_WITHOUT_FOLLOWUP_DAYS + 3)
    const items = computeFor({
      recordsByStudent: new Map([
        [
          's1',
          [
            record({
              id: 'obs-with-fu',
              record_date: oldObsDate,
              record_type: 'observation',
              content: 'has followup',
              followups: [openFollowup('fu1')],
            }),
            record({
              id: 'r-recent',
              record_date: AS_OF,
              record_type: 'general_note',
              content: 'recent',
            }),
          ],
        ],
      ]),
    })
    expect(items.filter((i) => i.ruleType === 'observation_without_followup')).toHaveLength(0)
  })

  it('flags parent contact without followup', () => {
    const oldDate = daysBeforeISO(AS_OF, REVIEW_PARENT_CONTACT_WITHOUT_FOLLOWUP_DAYS)
    const items = computeFor({
      recordsByStudent: new Map([
        [
          's1',
          [
            record({
              id: 'pc-gap',
              record_date: oldDate,
              record_type: 'parent_contact',
              content: 'called parent',
              contact_method: 'phone',
            }),
            record({
              id: 'pc-with-fu',
              record_date: oldDate,
              record_type: 'parent_contact',
              content: 'has fu',
              contact_method: 'phone',
              followups: [openFollowup('fu2')],
            }),
          ],
        ],
      ]),
    })
    const pcs = items.filter((i) => i.ruleType === 'parent_contact_without_followup')
    expect(pcs).toHaveLength(1)
    expect(pcs[0].sourceId).toBe('pc-gap')
  })

  it('flags student without recent record', () => {
    const lastDate = daysBeforeISO(AS_OF, REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS)
    const items = computeFor({
      recordsByStudent: new Map([
        [
          's1',
          [
            record({
              id: 'old',
              record_date: lastDate,
              record_type: 'observation',
              content: 'old',
            }),
          ],
        ],
      ]),
    })
    const gaps = items.filter((i) => i.ruleType === 'student_without_recent_record')
    expect(gaps).toHaveLength(1)
    expect(gaps[0].ageDays).toBe(REVIEW_STUDENT_WITHOUT_RECENT_RECORD_DAYS)
  })

  it('does not flag student with recent record', () => {
    const items = computeFor({
      recordsByStudent: new Map([
        [
          's1',
          [
            record({
              id: 'recent',
              record_date: daysBeforeISO(AS_OF, 3),
              record_type: 'observation',
              content: 'recent',
            }),
          ],
        ],
      ]),
    })
    expect(items.filter((i) => i.ruleType === 'student_without_recent_record')).toHaveLength(0)
  })
})

describe('isReviewHiddenByAction / filterActiveReviews', () => {
  const baseItem: ReviewItem = {
    id: 'stale_focus:f1',
    triggerKey: 'stale_focus:f1',
    ruleType: 'stale_focus',
    student: student({ id: 's1', korean_name: '김' }),
    sourceType: 'focus',
    sourceId: 'f1',
    ageDays: 20,
    title: 'stale',
    detail: 'detail',
  }

  function action(partial: Partial<ReviewActionRow> & Pick<ReviewActionRow, 'action'>): ReviewActionRow {
    return {
      id: 'a1',
      user_id: 'u1',
      student_id: 's1',
      rule_type: 'stale_focus',
      source_type: 'focus',
      source_id: 'f1',
      trigger_key: baseItem.triggerKey,
      snoozed_until: null,
      created_at: '2024-08-01T00:00:00Z',
      updated_at: '2024-08-01T00:00:00Z',
      ...partial,
    }
  }

  it('hides dismissed items', () => {
    const map = new Map([[baseItem.triggerKey, action({ action: 'dismissed' })]])
    expect(isReviewHiddenByAction(baseItem, map, AS_OF)).toBe(true)
  })

  it('hides snoozed items while snooze is active', () => {
    const map = new Map([
      [
        baseItem.triggerKey,
        action({ action: 'snoozed', snoozed_until: AS_OF }),
      ],
    ])
    expect(isReviewHiddenByAction(baseItem, map, AS_OF)).toBe(true)
  })

  it('shows items after snooze expires', () => {
    const map = new Map([
      [
        baseItem.triggerKey,
        action({ action: 'snoozed', snoozed_until: daysBeforeISO(AS_OF, 1) }),
      ],
    ])
    expect(isReviewHiddenByAction(baseItem, map, AS_OF)).toBe(false)
  })

  it('filterActiveReviews removes dismissed and active snoozes', () => {
    const other: ReviewItem = {
      ...baseItem,
      id: 'stale_focus:f2',
      triggerKey: 'stale_focus:f2',
      sourceId: 'f2',
    }
    const filtered = filterActiveReviews(
      [baseItem, other],
      [
        action({ action: 'dismissed' }),
        action({
          id: 'a2',
          action: 'snoozed',
          trigger_key: other.triggerKey,
          snoozed_until: daysBeforeISO(AS_OF, 1),
        }),
      ],
      AS_OF,
    )
    expect(filtered.map((i) => i.triggerKey)).toEqual(['stale_focus:f2'])
  })
})
