import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { completeFollowup, fetchFollowupsByStatus, fetchOpenFollowups } from '../lib/api'
import { RECORD_TYPES, labelOf, todayISO } from '../lib/constants'
import type { Followup } from '../lib/types'

type Tab = 'open' | 'due' | 'overdue' | 'done'

export function FollowupsPage({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<Tab>('open')
  const [openItems, setOpenItems] = useState<Followup[]>([])
  const [doneItems, setDoneItems] = useState<Followup[]>([])
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()

  async function reload() {
    const [o, d] = await Promise.all([fetchOpenFollowups(), fetchFollowupsByStatus('done')])
    setOpenItems(o)
    setDoneItems(d)
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [refreshKey])

  const list = useMemo(() => {
    if (tab === 'done') return doneItems
    if (tab === 'due') return openItems.filter((f) => f.due_date === today)
    if (tab === 'overdue')
      return openItems.filter((f) => f.due_date && f.due_date < today)
    return openItems
  }, [tab, openItems, doneItems, today])

  return (
    <div className="page">
      <h1>Follow-ups</h1>
      {error && <p className="error">{error}</p>}
      <div className="tabs">
        {(['open', 'due', 'overdue', 'done'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${tab === t ? 'primary' : 'ghost'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <ul className="nested-list">
        {list.map((f) => {
          const st = f.records?.students
          return (
            <li key={f.id}>
              <strong>{f.due_date ?? 'no due'}</strong> ·{' '}
              {st ? <Link to={`/students/${st.id}`}>{st.korean_name}</Link> : '—'} · {f.note}
              {f.records && (
                <span className="muted">
                  {' '}
                  (from {f.records.record_date} {labelOf(RECORD_TYPES, f.records.record_type)})
                </span>
              )}
              {f.status === 'open' && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void completeFollowup(f.id).then(reload)}
                >
                  Mark Done
                </button>
              )}
            </li>
          )
        })}
        {list.length === 0 && <li className="muted">없음</li>}
      </ul>
    </div>
  )
}
