import { useMemo } from 'react'
import { buildOpenActions } from '../../lib/studentSummary'
import type { RecordRow } from '../../lib/types'

export function StudentActionsSection({
  records,
  onOpenRecord,
}: {
  records: RecordRow[]
  onOpenRecord: (id: string) => void
}) {
  const actions = useMemo(() => buildOpenActions(records), [records])
  const primary = actions.filter(
    (a) => a.kind === 'overdue' || a.kind === 'today' || a.kind === 'stamp',
  )
  return (
    <section className="card section-actions">
      <h2 style={{ marginTop: 0 }}>Open Actions</h2>
      {primary.length === 0 ? (
        <p className="muted">열린 Follow-up / Pending Stamp 없음</p>
      ) : (
        <ul className="nested-list">
          {primary.map((a, i) => (
            <li key={`${a.kind}-${a.recordId}-${i}`}>
              <button
                type="button"
                className="btn ghost"
                style={{ textAlign: 'left', padding: 0 }}
                onClick={() => onOpenRecord(a.recordId)}
              >
                <span className="badge">{a.kind.toUpperCase()}</span>{' '}
                <strong>{a.title}</strong>
              </button>
              <div className="muted small">
                {a.dueDate ? `Due ${a.dueDate} · ` : ''}
                {a.detail}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
