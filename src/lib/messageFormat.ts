import { formatClassDisplay } from './classFormat'
import type { MessageRow, MessageTarget } from './types'

export function messageTargetSummary(targets: MessageTarget[] | undefined): string {
  if (!targets || targets.length === 0) return '대상 미지정'
  if (targets.some((t) => t.target_type === 'all')) return '전체'
  const classes = targets
    .filter((t) => t.target_type === 'class')
    .map((t) => (t.classes ? formatClassDisplay(t.classes) : '반'))
  const students = targets
    .filter((t) => t.target_type === 'student')
    .map((t) => t.students?.korean_name ?? '학생')
  const parts = [...classes, ...students]
  if (parts.length === 0) return '대상 미지정'
  if (parts.length <= 3) return parts.join(', ')
  return `${parts.slice(0, 3).join(', ')} 외 ${parts.length - 3}`
}

export function messageSnippet(content: string, max = 100): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max)}…`
}

export function messageDisplayTitle(m: MessageRow): string {
  if (m.title?.trim()) return m.title.trim()
  return messageSnippet(m.content, 40)
}
