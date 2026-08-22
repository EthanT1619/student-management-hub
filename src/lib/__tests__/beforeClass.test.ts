import { describe, expect, it } from 'vitest'
import {
  attentionSortKey,
  compareAttention,
  hasManagementAttention,
  partitionFollowupsForDate,
  studentNeedsAttention,
  type BeforeClassStudentBundle,
} from '../beforeClass'
import type { Followup, RecordRow, Student } from '../types'

function student(partial: Partial<Student> & Pick<Student, 'id' | 'korean_name'>): Student {
  return {
    english_name: null,
    class_id: 'class-1',
    accent_color: null,
    enrollment_status: 'active',
    parent_management_status: 'stable',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...partial,
  }
}

function followup(
  partial: Partial<Followup> & Pick<Followup, 'id' | 'due_date'>,
): Followup {
  return {
    record_id: 'rec-1',
    note: 'check',
    status: 'open',
    completed_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...partial,
  }
}

function emptyBundle(
  overrides: Partial<BeforeClassStudentBundle> & { student: Student },
): BeforeClassStudentBundle {
  return {
    overdueFollowups: [],
    dueTodayFollowups: [],
    upcomingFollowups: [],
    openFocus: [],
    pendingStamps: [],
    importantRecords: [],
    ...overrides,
  }
}

describe('hasManagementAttention', () => {
  it('returns true for intensive_care and retention_risk', () => {
    expect(hasManagementAttention('intensive_care')).toBe(true)
    expect(hasManagementAttention('retention_risk')).toBe(true)
  })

  it('returns false for other statuses', () => {
    expect(hasManagementAttention('stable')).toBe(false)
    expect(hasManagementAttention('unclassified')).toBe(false)
    expect(hasManagementAttention('temporary_leave')).toBe(false)
    expect(hasManagementAttention('withdrawn')).toBe(false)
  })
})

describe('studentNeedsAttention', () => {
  it('is false when student has no attention conditions', () => {
    const item = emptyBundle({ student: student({ id: 's1', korean_name: '가나다' }) })
    expect(studentNeedsAttention(item)).toBe(false)
  })

  it('is true for overdue followups', () => {
    const item = emptyBundle({
      student: student({ id: 's1', korean_name: '가나다' }),
      overdueFollowups: [followup({ id: 'f1', due_date: '2024-06-01' })],
    })
    expect(studentNeedsAttention(item)).toBe(true)
  })

  it('is true for due-today followups', () => {
    const item = emptyBundle({
      student: student({ id: 's1', korean_name: '가나다' }),
      dueTodayFollowups: [followup({ id: 'f1', due_date: '2024-06-15' })],
    })
    expect(studentNeedsAttention(item)).toBe(true)
  })

  it('is true for pending stamps', () => {
    const stamp = {
      id: 'r1',
      student_id: 's1',
      record_date: '2024-06-01',
      record_type: 'stamp' as const,
      content: 'stamp',
      is_important: false,
      contact_method: null,
      stamp_amount: 1,
      stamp_status: 'pending' as const,
      stamp_given_at: null,
      created_by: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    } satisfies RecordRow
    const item = emptyBundle({
      student: student({ id: 's1', korean_name: '가나다' }),
      pendingStamps: [stamp],
    })
    expect(studentNeedsAttention(item)).toBe(true)
  })

  it('is true for management attention status', () => {
    const item = emptyBundle({
      student: student({
        id: 's1',
        korean_name: '가나다',
        parent_management_status: 'retention_risk',
      }),
    })
    expect(studentNeedsAttention(item)).toBe(true)
  })

  it('is true for important records', () => {
    const rec = {
      id: 'r1',
      student_id: 's1',
      record_date: '2024-06-01',
      record_type: 'observation' as const,
      content: 'note',
      is_important: true,
      contact_method: null,
      stamp_amount: null,
      stamp_status: null,
      stamp_given_at: null,
      created_by: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    } satisfies RecordRow
    const item = emptyBundle({
      student: student({ id: 's1', korean_name: '가나다' }),
      importantRecords: [rec],
    })
    expect(studentNeedsAttention(item)).toBe(true)
  })
})

describe('attentionSortKey / compareAttention', () => {
  it('prioritizes overdue followups over due today', () => {
    const overdue = emptyBundle({
      student: student({ id: 'a', korean_name: '김' }),
      overdueFollowups: [followup({ id: 'f1', due_date: '2024-06-01' })],
    })
    const dueToday = emptyBundle({
      student: student({ id: 'b', korean_name: '이' }),
      dueTodayFollowups: [followup({ id: 'f2', due_date: '2024-06-15' })],
    })
    expect(compareAttention(overdue, dueToday)).toBeLessThan(0)
    expect(attentionSortKey(overdue)[0]).toBe(0)
    expect(attentionSortKey(dueToday)[0]).toBe(1)
  })

  it('prioritizes retention_risk over intensive_care when followups equal', () => {
    const risk = emptyBundle({
      student: student({
        id: 'a',
        korean_name: '김',
        parent_management_status: 'retention_risk',
      }),
    })
    const intensive = emptyBundle({
      student: student({
        id: 'b',
        korean_name: '이',
        parent_management_status: 'intensive_care',
      }),
    })
    expect(compareAttention(risk, intensive)).toBeLessThan(0)
  })

  it('falls back to korean_name when other keys tie', () => {
    const a = emptyBundle({ student: student({ id: 'a', korean_name: '가' }) })
    const b = emptyBundle({ student: student({ id: 'b', korean_name: '나' }) })
    expect(compareAttention(a, b)).toBeLessThan(0)
    expect(compareAttention(b, a)).toBeGreaterThan(0)
  })
})

describe('partitionFollowupsForDate', () => {
  const asOf = '2024-06-15'

  it('partitions open followups into overdue / today / upcoming', () => {
    const items = [
      followup({ id: 'overdue', due_date: '2024-06-10' }),
      followup({ id: 'today', due_date: '2024-06-15' }),
      followup({ id: 'upcoming', due_date: '2024-06-20' }),
      followup({ id: 'no-date', due_date: null }),
      followup({ id: 'done', due_date: '2024-06-01', status: 'done' }),
    ]
    const { overdue, dueToday, upcoming } = partitionFollowupsForDate(items, asOf)
    expect(overdue.map((f) => f.id)).toEqual(['overdue'])
    expect(dueToday.map((f) => f.id)).toEqual(['today'])
    expect(upcoming.map((f) => f.id)).toEqual(['no-date', 'upcoming'])
  })

  it('sorts each bucket by due_date', () => {
    const items = [
      followup({ id: 'o2', due_date: '2024-06-12' }),
      followup({ id: 'o1', due_date: '2024-06-01' }),
      followup({ id: 'u2', due_date: '2024-06-22' }),
      followup({ id: 'u1', due_date: '2024-06-18' }),
    ]
    const { overdue, upcoming } = partitionFollowupsForDate(items, asOf)
    expect(overdue.map((f) => f.id)).toEqual(['o1', 'o2'])
    expect(upcoming.map((f) => f.id)).toEqual(['u1', 'u2'])
  })
})
