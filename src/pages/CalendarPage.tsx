import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchMonthCalendarMarks,
  fetchMonthDueMarks,
  fetchOpenFollowups,
  fetchOpenWorkFollowups,
  fetchRecordsByDate,
  type CalendarDayStudent,
  type CalendarDueItem,
} from '../lib/api'
import { RECORD_TYPES, labelOf, todayISO } from '../lib/constants'
import type { Followup, RecordRow, WorkFollowup } from '../lib/types'

const MAX_NAMES = 3

type CalFilter = 'all' | 'records' | 'due'

export function CalendarPage({ refreshKey }: { refreshKey: number }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selected, setSelected] = useState(todayISO())
  const [recordMarks, setRecordMarks] = useState<Record<string, CalendarDayStudent[]>>({})
  const [dueMarks, setDueMarks] = useState<Record<string, CalendarDueItem[]>>({})
  const [dayRecords, setDayRecords] = useState<RecordRow[]>([])
  const [dayDues, setDayDues] = useState<CalendarDueItem[]>([])
  const [filter, setFilter] = useState<CalFilter>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [marks, dues] = await Promise.all([
          fetchMonthCalendarMarks(year, month),
          fetchMonthDueMarks(year, month),
        ])
        setRecordMarks(marks)
        setDueMarks(dues)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      }
    })()
  }, [year, month, refreshKey])

  useEffect(() => {
    void (async () => {
      try {
        const [recs, fus, wfs] = await Promise.all([
          fetchRecordsByDate(selected),
          fetchOpenFollowups(),
          fetchOpenWorkFollowups().catch(() => [] as WorkFollowup[]),
        ])
        setDayRecords(recs)
        const dueItems: CalendarDueItem[] = []
        for (const f of fus as Followup[]) {
          if (f.due_date !== selected) continue
          const st = f.records?.students
          if (!st?.id) continue
          dueItems.push({
            id: f.id,
            studentId: st.id,
            korean_name: st.korean_name,
            note: f.note,
            kind: 'followup',
          })
        }
        for (const f of wfs) {
          if (f.due_date !== selected) continue
          dueItems.push({
            id: f.id,
            studentId: '',
            korean_name: 'Work',
            note: f.note,
            kind: 'work',
          })
        }
        setDayDues(dueItems)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Load failed')
      }
    })()
  }, [selected, refreshKey])

  const cells = useMemo(() => buildMonthCells(year, month), [year, month])

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendar</h1>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => shift(-1)}>
            ◀
          </button>
          <strong>
            {year}-{String(month).padStart(2, '0')}
          </strong>
          <button type="button" className="btn ghost" onClick={() => shift(1)}>
            ▶
          </button>
        </div>
      </div>

      <div className="row wrap gap">
        {(
          [
            ['all', '전체'],
            ['records', '기록'],
            ['due', '예정'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn small ${filter === value ? 'primary' : 'ghost'}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">
        기록 = 실제 사건일(record date) · 예정 = Follow-up due date. 색만으로 구분하지 않습니다.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="cal-head">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`e-${i}`} className="cal-day empty" />
          const students = filter === 'due' ? [] : (recordMarks[c] ?? [])
          const dues = filter === 'records' ? [] : (dueMarks[c] ?? [])
          const shown = students.slice(0, MAX_NAMES)
          const extra = students.length - shown.length
          const has = students.length > 0 || dues.length > 0
          return (
            <button
              key={c}
              type="button"
              className={`cal-day ${selected === c ? 'selected' : ''} ${has ? 'has' : ''}`}
              onClick={() => setSelected(c)}
            >
              <span className="cal-day-num">{Number(c.slice(-2))}</span>
              {shown.map((s) => (
                <span key={s.id} className="cal-student">
                  <span
                    className={`cal-dot ${s.accent_color ? `accent-${s.accent_color}` : ''}`}
                  />
                  {s.korean_name}
                </span>
              ))}
              {extra > 0 && <span className="cal-more">+{extra}명</span>}
              {dues.length > 0 && (
                <span className="cal-due-mark" title={`${dues.length}건 예정`}>
                  ◯ Due {dues.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <section className="card">
        <h2>Selected: {selected}</h2>
        {(filter === 'all' || filter === 'records') && (
          <>
            <h3 className="dt-subhead" style={{ textTransform: 'none' }}>
              기록 (Event Date)
            </h3>
            <ul className="nested-list">
              {dayRecords.map((r) => (
                <li key={r.id}>
                  {r.students ? (
                    <Link to={`/students/${r.students.id}`}>
                      {r.students.accent_color && (
                        <span className={`accent-dot accent-${r.students.accent_color}`} />
                      )}
                      {r.students.korean_name}
                    </Link>
                  ) : (
                    '—'
                  )}{' '}
                  — {labelOf(RECORD_TYPES, r.record_type)}
                  {r.record_type === 'stamp' ? ` +${r.stamp_amount}` : ''} · {r.content}
                </li>
              ))}
              {dayRecords.length === 0 && <li className="muted">기록 없음</li>}
            </ul>
          </>
        )}
        {(filter === 'all' || filter === 'due') && (
          <>
            <h3 className="dt-subhead" style={{ textTransform: 'none' }}>
              예정 (Due Date)
            </h3>
            <ul className="nested-list">
              {dayDues.map((d) => (
                <li key={d.id}>
                  <span className="cal-due-mark">◯ Due</span>{' '}
                  {d.studentId ? (
                    <Link to={`/students/${d.studentId}`}>{d.korean_name}</Link>
                  ) : (
                    d.korean_name
                  )}{' '}
                  · {d.note}
                </li>
              ))}
              {dayDues.length === 0 && <li className="muted">예정 없음</li>}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    )
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
