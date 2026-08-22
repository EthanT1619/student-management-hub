import { formatClassDisplay } from './classFormat'
import type { WorkNoteRow } from './types'

export function workNoteDisplayTitle(n: WorkNoteRow): string {
  if (n.title?.trim()) return n.title.trim()
  const flat = n.content.replace(/\s+/g, ' ').trim()
  return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat
}

export function workNoteSnippet(content: string, max = 100): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max)}…`
}

export function workNoteRelatedSummary(n: WorkNoteRow): string {
  const classes = (n.work_note_classes ?? []).map((x) =>
    x.classes ? formatClassDisplay(x.classes) : '반',
  )
  const students = (n.work_note_students ?? []).map(
    (x) => x.students?.korean_name ?? '학생',
  )
  const parts = [...classes, ...students]
  if (parts.length === 0) return '관련 대상 없음'
  if (parts.length <= 3) return parts.join(', ')
  return `${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}`
}

export function openWorkFollowupCount(n: WorkNoteRow): number {
  return (n.work_followups ?? []).filter((f) => f.status === 'open').length
}
