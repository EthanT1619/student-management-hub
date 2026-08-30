/** Dashboard Current Focus Overview — preview without silent data loss. */

export const FOCUS_OVERVIEW_PREVIEW_LIMIT = 12

export function partitionFocusOverviewPreview<T>(
  items: T[],
  previewLimit: number = FOCUS_OVERVIEW_PREVIEW_LIMIT,
): {
  total: number
  visible: T[]
  hiddenCount: number
} {
  const total = items.length
  const limit = Math.max(0, previewLimit)
  if (total <= limit) {
    return { total, visible: items, hiddenCount: 0 }
  }
  return {
    total,
    visible: items.slice(0, limit),
    hiddenCount: total - limit,
  }
}
