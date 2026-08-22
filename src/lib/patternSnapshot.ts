/**
 * Load a compact Pattern Tracker snapshot for a student (current term).
 * Lives in lib so pages/modals do not own data-fetch helpers.
 */
import { fetchPatternSourceBundle } from './api'
import {
  buildPatternProfileSnapshot,
  resolvePatternDateRange,
  type PatternProfileSnapshot,
} from './patternTracker'

export async function loadPatternSnapshot(
  studentId: string,
): Promise<PatternProfileSnapshot> {
  const bundle = await fetchPatternSourceBundle(studentId)
  const range = resolvePatternDateRange('current_term', bundle.currentTerm)
  return buildPatternProfileSnapshot(bundle, range)
}

export type { PatternProfileSnapshot }
