import type { LevelRow } from './types'

/** Resolve level name for create/update class UI (admin may create new shared level). */
export function resolveClassLevelName(input: {
  isAdmin: boolean
  selectedLevelName: string
  newLevelName?: string
}): string {
  const created = input.newLevelName?.trim() ?? ''
  if (input.isAdmin && created) return created
  const selected = input.selectedLevelName.trim()
  if (!selected) {
    throw new Error('Level을 선택하세요. 없는 Level은 관리자에게 추가를 요청하세요.')
  }
  return selected
}

export function levelOptionsWithCurrent(
  levels: LevelRow[],
  currentName: string | null | undefined,
): LevelRow[] {
  const name = currentName?.trim()
  if (!name) return levels
  if (levels.some((l) => l.name === name)) return levels
  return [{ id: `__current__:${name}`, name, sort_order: -1 }, ...levels]
}
