import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMessagesForStudent } from '../lib/api'
import { MESSAGE_PURPOSES, labelOf } from '../lib/constants'
import {
  messageDisplayTitle,
  messageSnippet,
  messageTargetSummary,
} from '../lib/messageFormat'
import type { MessageRow } from '../lib/types'

export function StudentMessagesModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string
  studentName: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<MessageRow | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setMessages(await fetchMessagesForStudent(studentId))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [studentId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal message-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <div>
            <h2 style={{ margin: 0 }}>{studentName} · Messages</h2>
            <p className="muted small" style={{ margin: 0 }}>
              직접 대상 + 현재 반 대상 + 전체 공지
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Loading…</p>}

        {!loading && messages.length === 0 && (
          <p className="muted">관련 문자가 없습니다.</p>
        )}

        <ul className="nested-list">
          {messages.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="btn ghost"
                style={{ textAlign: 'left', width: '100%' }}
                onClick={() => setExpanded(m)}
              >
                <span className="muted small">{m.message_date}</span>{' '}
                <span className="badge">{labelOf(MESSAGE_PURPOSES, m.purpose)}</span>
                <div>
                  <strong>{messageDisplayTitle(m)}</strong>
                </div>
                <div className="muted small">{messageSnippet(m.content, 80)}</div>
              </button>
            </li>
          ))}
        </ul>

        <div className="row end">
          <Link className="btn" to={`/messages?studentId=${studentId}`} onClick={onClose}>
            Messages에서 보기
          </Link>
        </div>

        {expanded && (
          <div className="modal-backdrop" onClick={() => setExpanded(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{messageDisplayTitle(expanded)}</h3>
              <p className="muted small">
                {expanded.message_date} · {labelOf(MESSAGE_PURPOSES, expanded.purpose)}
              </p>
              <p className="muted small">
                대상: {messageTargetSummary(expanded.message_targets)}
              </p>
              <pre className="message-body">{expanded.content}</pre>
              <button type="button" className="btn" onClick={() => setExpanded(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
