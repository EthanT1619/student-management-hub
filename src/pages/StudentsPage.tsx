import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  changeStudentClass,
  clearStudentClass,
  createClass,
  createStudent,
  fetchClasses,
  fetchCurrentTerm,
  fetchStudents,
  fetchTerms,
  updateStudent,
} from '../lib/api'
import { formatClassDisplay, DAYS_CODE_SELECT_OPTIONS } from '../lib/classFormat'
import {
  ACCENT_COLORS,
  ENROLLMENT_STATUSES,
  MANAGEMENT_STATUS_LABEL,
  PARENT_STATUSES,
  labelOf,
} from '../lib/constants'
import type { AccentColor } from '../lib/constants'
import type { ClassRow, DaysCode, EnrollmentStatus, Student, TermRow } from '../lib/types'
import { useSearchParams } from 'react-router-dom'

export function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [terms, setTerms] = useState<TermRow[]>([])
  const [currentTerm, setCurrentTerm] = useState<TermRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [enrollment, setEnrollment] = useState<string>('active')
  const [parentStatus, setParentStatus] = useState('')
  const [classId, setClassId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [prefClassId, setPrefClassId] = useState('')

  async function reload() {
    const [term, termList] = await Promise.all([fetchCurrentTerm(), fetchTerms()])
    setCurrentTerm(term)
    setTerms(termList)
    const [s, c] = await Promise.all([
      fetchStudents(),
      fetchClasses(term?.id),
    ])
    setStudents(s)
    setClasses(
      [...c].sort((a, b) =>
        formatClassDisplay(a).localeCompare(formatClassDisplay(b), 'ko'),
      ),
    )
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [])

  useEffect(() => {
    const add = searchParams.get('add')
    const cid = searchParams.get('classId') ?? ''
    if (add === '1') {
      setEditing(null)
      setPrefClassId(cid)
      setShowForm(true)
      const next = new URLSearchParams(searchParams)
      next.delete('add')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (enrollment && s.enrollment_status !== enrollment) return false
      if (parentStatus && s.parent_management_status !== parentStatus) return false
      if (classId && s.class_id !== classId) return false
      if (q) {
        const hay = `${s.korean_name} ${s.english_name ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [students, enrollment, parentStatus, classId, q])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Students</h1>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setEditing(null)
            setPrefClassId('')
            setShowForm(true)
          }}
        >
          + Add Student
        </button>
      </div>
      {currentTerm && (
        <p className="muted small">현재 학기: {currentTerm.name} (반 선택 목록)</p>
      )}

      <div className="filters row wrap">
        <input placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">전체 반</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {formatClassDisplay(c)}
            </option>
          ))}
        </select>
        <select value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
          <option value="">전체 재원상태</option>
          {ENROLLMENT_STATUSES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select value={parentStatus} onChange={(e) => setParentStatus(e.target.value)}>
          <option value="">전체 {MANAGEMENT_STATUS_LABEL}</option>
          {PARENT_STATUSES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>반</th>
              <th>재원</th>
              <th>{MANAGEMENT_STATUS_LABEL}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/students/${s.id}`}>
                    {s.accent_color && (
                      <span className={`accent-dot accent-${s.accent_color}`} />
                    )}
                    {s.korean_name}
                    {s.english_name ? ` / ${s.english_name}` : ''}
                  </Link>
                </td>
                <td>
                  {s.classes
                    ? formatClassDisplay({ ...s.classes, includeTerm: true })
                    : '—'}
                </td>
                <td>{labelOf(ENROLLMENT_STATUSES, s.enrollment_status)}</td>
                <td>
                  <span className={`badge badge-mgmt ${s.parent_management_status}`}>
                    {labelOf(PARENT_STATUSES, s.parent_management_status)}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      setEditing(s)
                      setShowForm(true)
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <StudentForm
          classes={classes}
          terms={terms}
          currentTermId={currentTerm?.id ?? ''}
          initial={editing}
          preferredClassId={prefClassId}
          onClose={() => {
            setShowForm(false)
            setPrefClassId('')
          }}
          onSaved={async () => {
            setShowForm(false)
            setPrefClassId('')
            await reload()
          }}
          onClassesChanged={async (selectedId) => {
            await reload()
            if (selectedId) setPrefClassId(selectedId)
          }}
        />
      )}
    </div>
  )
}

function StudentForm({
  classes,
  terms,
  currentTermId,
  initial,
  preferredClassId,
  onClose,
  onSaved,
  onClassesChanged,
}: {
  classes: ClassRow[]
  terms: TermRow[]
  currentTermId: string
  initial: Student | null
  preferredClassId?: string
  onClose: () => void
  onSaved: () => Promise<void>
  onClassesChanged: (selectedClassId: string) => Promise<void>
}) {
  const [koreanName, setKoreanName] = useState(initial?.korean_name ?? '')
  const [englishName, setEnglishName] = useState(initial?.english_name ?? '')
  const [classId, setClassId] = useState(
    preferredClassId || initial?.class_id || '',
  )
  const [moveNote, setMoveNote] = useState('')
  const [enrollment, setEnrollment] = useState<EnrollmentStatus>(
    initial?.enrollment_status ?? 'active',
  )
  const [accentColor, setAccentColor] = useState<AccentColor | ''>(
    (initial?.accent_color as AccentColor | null) ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showNewClass, setShowNewClass] = useState(false)

  useEffect(() => {
    if (preferredClassId) setClassId(preferredClassId)
  }, [preferredClassId])

  useEffect(() => {
    if (preferredClassId) setClassId(preferredClassId)
  }, [preferredClassId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const resolvedClassId = classId || null
      if (initial) {
        await updateStudent(initial.id, {
          korean_name: koreanName.trim(),
          english_name: englishName.trim() || null,
          enrollment_status: enrollment,
          accent_color: accentColor || null,
        })
        const prev = initial.class_id ?? null
        if (resolvedClassId !== prev) {
          if (resolvedClassId) {
            await changeStudentClass({
              student_id: initial.id,
              new_class_id: resolvedClassId,
              note: moveNote.trim() || undefined,
            })
          } else {
            await clearStudentClass({
              student_id: initial.id,
              note: moveNote.trim() || 'Class cleared',
            })
          }
        }
      } else {
        await createStudent({
          korean_name: koreanName.trim(),
          english_name: englishName.trim() || null,
          class_id: resolvedClassId,
          enrollment_status: enrollment,
        })
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const classChanged = Boolean(initial) && (classId || null) !== (initial?.class_id ?? null)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit Student' : 'Add Student'}</h2>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <label>
            한글 이름 *
            <input value={koreanName} onChange={(e) => setKoreanName(e.target.value)} required />
          </label>
          <label>
            영어 이름
            <input value={englishName} onChange={(e) => setEnglishName(e.target.value)} />
          </label>
          <label>
            반 (현재 학기)
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">미지정</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassDisplay(c)}
                </option>
              ))}
            </select>
          </label>
          {!initial && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setShowNewClass(true)}
            >
              + 새 반 만들기
            </button>
          )}
          {classChanged && (
            <label>
              반 이동 사유 (선택)
              <input
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                placeholder="예: 학기 진급 DSC1 → DSC2"
              />
            </label>
          )}
          <label>
            재원 상태
            <select
              value={enrollment}
              onChange={(e) => setEnrollment(e.target.value as EnrollmentStatus)}
            >
              {ENROLLMENT_STATUSES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {initial && (
            <label>
              Student Accent Color
              <select
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value as AccentColor | '')}
              >
                {ACCENT_COLORS.map((x) => (
                  <option key={x.value || 'none'} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
              <span className="muted small">
                Calendar 표시용. 관리상태와 무관한 추적 보조 색상입니다.
              </span>
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <div className="row end">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {showNewClass && (
          <InlineClassCreate
            terms={terms}
            defaultTermId={currentTermId}
            onClose={() => setShowNewClass(false)}
            onCreated={async (created) => {
              setShowNewClass(false)
              setClassId(created.id)
              await onClassesChanged(created.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

function InlineClassCreate({
  terms,
  defaultTermId,
  onClose,
  onCreated,
}: {
  terms: TermRow[]
  defaultTermId: string
  onClose: () => void
  onCreated: (row: ClassRow) => Promise<void>
}) {
  const [termId, setTermId] = useState(defaultTermId)
  const [levelName, setLevelName] = useState('')
  const [daysCode, setDaysCode] = useState<DaysCode>('MWF')
  const [period, setPeriod] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await createClass({
        level_name: levelName,
        days_code: daysCode,
        period,
        term_id: termId || null,
      })
      await onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack nested" style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
      <h3 style={{ margin: 0 }}>새 반 만들기</h3>
      <form className="stack" onSubmit={(e) => void onSubmit(e)}>
        <label>
          학기 *
          <select value={termId} onChange={(e) => setTermId(e.target.value)} required>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_current ? ' (현재)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level *
          <input value={levelName} onChange={(e) => setLevelName(e.target.value)} required />
        </label>
        <label>
          요일 *
          <select
            value={daysCode}
            onChange={(e) => setDaysCode(e.target.value as DaysCode)}
          >
            {DAYS_CODE_SELECT_OPTIONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          교시 *
          <input value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            반 저장
          </button>
        </div>
      </form>
    </div>
  )
}
