export type DaysCode = 'MWF' | 'TT' | 'MW' | 'TF' | 'FS' | 'MTWTF' | 'UNSET'

/** Full labels for display of any stored value (incl. legacy) */
export const DAYS_CODE_OPTIONS: { value: DaysCode; label: string }[] = [
  { value: 'MWF', label: '월수금' },
  { value: 'TT', label: '화목' },
  { value: 'MW', label: '월수' },
  { value: 'TF', label: '화금' },
  { value: 'FS', label: '금토' },
  { value: 'MTWTF', label: '월~금' },
  { value: 'UNSET', label: '요일미정' },
]

/** Class create/edit: academy only uses these two */
export const DAYS_CODE_SELECT_OPTIONS: { value: 'MWF' | 'TT'; label: string }[] = [
  { value: 'MWF', label: '월수금' },
  { value: 'TT', label: '화목' },
]

export function daysCodeLabel(code: string | null | undefined): string {
  return DAYS_CODE_OPTIONS.find((x) => x.value === code)?.label ?? code ?? '요일미정'
}

export function periodLabel(period: string | null | undefined): string {
  if (!period || period === 'UNSET') return '교시미정'
  if (/교시$/.test(period)) return period
  return `${period}교시`
}

/** 학원 보고 형식: 월수금 3.5교시 LSA1 (학기명은 선택) */
export function formatClassDisplay(input: {
  days_code?: string | null
  period?: string | null
  level_name?: string | null
  levels?: { name: string } | null
  term_name?: string | null
  terms?: { name: string } | null
  includeTerm?: boolean
}): string {
  const level = input.level_name ?? input.levels?.name ?? '레벨미정'
  const base = `${daysCodeLabel(input.days_code)} ${periodLabel(input.period)} ${level}`
  if (!input.includeTerm) return base
  const term = input.term_name ?? input.terms?.name
  return term ? `${term} · ${base}` : base
}
