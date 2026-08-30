import { describe, expect, it } from 'vitest'
import {
  FOCUS_OVERVIEW_PREVIEW_LIMIT,
  partitionFocusOverviewPreview,
} from '../focusOverview'

describe('partitionFocusOverviewPreview', () => {
  it('does not hide items when at or under preview limit', () => {
    const items = Array.from({ length: 12 }, (_, i) => i)
    const part = partitionFocusOverviewPreview(items, FOCUS_OVERVIEW_PREVIEW_LIMIT)
    expect(part.total).toBe(12)
    expect(part.visible).toEqual(items)
    expect(part.hiddenCount).toBe(0)
  })

  it('keeps full total while previewing first N (no silent drop)', () => {
    const items = Array.from({ length: 14 }, (_, i) => `s${i}`)
    const part = partitionFocusOverviewPreview(items, 12)
    expect(part.total).toBe(14)
    expect(part.visible).toEqual(items.slice(0, 12))
    expect(part.hiddenCount).toBe(2)
    expect(part.visible.length + part.hiddenCount).toBe(part.total)
  })

  it('shows all when expanded via infinite limit', () => {
    const items = [1, 2, 3, 4]
    const part = partitionFocusOverviewPreview(items, Number.POSITIVE_INFINITY)
    expect(part.visible).toEqual(items)
    expect(part.hiddenCount).toBe(0)
  })
})

describe('focus edit semantics (pure)', () => {
  it('updates focus fields without inventing a new id (same-row edit)', () => {
    const before = {
      id: 'focus-1',
      title: 'old',
      note: 'n',
      recordContent: 'original record body',
    }
    const after = {
      ...before,
      title: 'new title',
      note: 'revised',
    }
    expect(after.id).toBe(before.id)
    expect(after.recordContent).toBe(before.recordContent)
    expect(after.title).not.toBe(before.title)
  })
})
