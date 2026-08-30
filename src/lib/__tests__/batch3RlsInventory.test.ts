import { describe, expect, it } from 'vitest'

/**
 * Static inventory aligned with Batch 3 RLS cutover (020).
 * Guards against accidentally omitting an application table from the matrix.
 */
export const BATCH3_APP_TABLES = [
  'profiles',
  'classes',
  'students',
  'tags',
  'current_focus_items',
  'records',
  'record_tags',
  'followups',
  'parent_status_history',
  'levels',
  'terms',
  'student_class_history',
  'review_actions',
  'messages',
  'message_targets',
  'work_notes',
  'work_note_students',
  'work_note_classes',
  'work_followups',
  'cases',
  'case_records',
  'student_voice_entries',
  'working_hypotheses',
  'hypothesis_records',
  'interventions',
  'intervention_responses',
  'abc_observations',
  'context_tags',
  'record_context_tags',
  'hypothesis_interventions',
  'consultation_notes',
] as const

export const BATCH3_SHARED_MASTERS = ['terms', 'levels', 'tags', 'context_tags'] as const

export const BATCH3_OWNER_ROOTS = [
  'students',
  'classes',
  'work_notes',
  'messages',
] as const

describe('Batch 3 RLS table inventory', () => {
  it('covers known application tables without duplicates', () => {
    expect(new Set(BATCH3_APP_TABLES).size).toBe(BATCH3_APP_TABLES.length)
    expect(BATCH3_APP_TABLES).toContain('consultation_notes')
    expect(BATCH3_APP_TABLES).toContain('hypothesis_interventions')
    expect(BATCH3_APP_TABLES).not.toContain('allowed_student_hub_users')
  })

  it('marks shared masters distinctly from owner roots', () => {
    for (const t of BATCH3_SHARED_MASTERS) {
      expect(BATCH3_APP_TABLES).toContain(t)
      expect(BATCH3_OWNER_ROOTS).not.toContain(t as never)
    }
  })
})
