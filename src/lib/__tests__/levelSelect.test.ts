import { describe, expect, it } from 'vitest'
import { levelOptionsWithCurrent, resolveClassLevelName } from '../levelSelect'

describe('resolveClassLevelName', () => {
  it('uses selected level for teachers', () => {
    expect(
      resolveClassLevelName({
        isAdmin: false,
        selectedLevelName: 'DSC1',
        newLevelName: 'SHOULD_IGNORE',
      }),
    ).toBe('DSC1')
  })

  it('rejects empty selection for teachers', () => {
    expect(() =>
      resolveClassLevelName({ isAdmin: false, selectedLevelName: '  ' }),
    ).toThrow(/Level/)
  })

  it('prefers new level name for admins', () => {
    expect(
      resolveClassLevelName({
        isAdmin: true,
        selectedLevelName: 'DSC1',
        newLevelName: 'NEW_L',
      }),
    ).toBe('NEW_L')
  })

  it('falls back to selected level for admins without new name', () => {
    expect(
      resolveClassLevelName({
        isAdmin: true,
        selectedLevelName: 'LSA1',
        newLevelName: '',
      }),
    ).toBe('LSA1')
  })
})

describe('levelOptionsWithCurrent', () => {
  it('injects current name when missing from shared list', () => {
    const opts = levelOptionsWithCurrent(
      [{ id: '1', name: 'DSC1', sort_order: 0 }],
      'LEGACY',
    )
    expect(opts.map((l) => l.name)).toEqual(['LEGACY', 'DSC1'])
  })
})
