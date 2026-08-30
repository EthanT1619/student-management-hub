import { FormEvent, useState } from 'react'
import { completeFocusItem, createFocusItem, updateFocusItem } from '../../lib/api'
import type { CurrentFocusItem, Tag } from '../../lib/types'

type EditDraft = {
  id: string
  title: string
  note: string
  tag_id: string
}

export function StudentFocusSection({
  studentId,
  items,
  tags,
  onChanged,
}: {
  studentId: string
  items: CurrentFocusItem[]
  tags: Tag[]
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [tagId, setTagId] = useState('')
  const [edit, setEdit] = useState<EditDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const openItems = items.filter((i) => i.status === 'open')

  function closeCreate() {
    setOpen(false)
    setError(null)
  }

  function closeEdit() {
    setEdit(null)
    setError(null)
  }

  function startEdit(item: CurrentFocusItem) {
    setError(null)
    setOpen(false)
    setEdit({
      id: item.id,
      title: item.title,
      note: item.note ?? '',
      tag_id: item.tag_id ?? '',
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createFocusItem({
        student_id: studentId,
        title: title.trim(),
        note: note.trim() || null,
        tag_id: tagId || null,
        sort_order: openItems.length,
      })
      setTitle('')
      setNote('')
      setTagId('')
      setOpen(false)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    setBusy(true)
    setError(null)
    try {
      await updateFocusItem(edit.id, {
        title: edit.title.trim(),
        note: edit.note.trim() || null,
        tag_id: edit.tag_id || null,
      })
      setEdit(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card section-now">
      <div className="page-header">
        <h2>NOW · Current Focus</h2>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            setError(null)
            setEdit(null)
            setOpen(true)
          }}
        >
          + Focus 직접 추가
        </button>
      </div>
      <ul className="focus-list">
        {openItems.map((item) => (
          <li key={item.id}>
            <div className="focus-item-main">
              <strong>{item.title}</strong>
              {item.note ? <span className="muted"> — {item.note}</span> : null}
            </div>
            <div className="row gap focus-item-actions">
              <button
                type="button"
                className="btn ghost small"
                onClick={() => startEdit(item)}
              >
                수정
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => void completeFocusItem(item.id).then(onChanged)}
              >
                Done
              </button>
            </div>
          </li>
        ))}
        {openItems.length === 0 && <li className="muted">등록된 Focus 없음</li>}
      </ul>
      {open && (
        <div className="modal-backdrop" onClick={closeCreate}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Current Focus</h3>
            <form className="stack" onSubmit={(e) => void onSubmit(e)}>
              <label>
                Title *
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  disabled={busy}
                />
              </label>
              <label>
                Optional Tag (개념 연결만, Focus ≠ Tag)
                <select
                  value={tagId}
                  onChange={(e) => setTagId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">없음</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="row end">
                <button type="button" className="btn ghost" onClick={closeCreate} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {edit && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Current Focus 수정</h3>
            <p className="muted small">
              같은 Focus를 직접 수정합니다. Done 후 새로 만들지 않습니다. Record 원문은 바뀌지
              않습니다.
            </p>
            <form className="stack" onSubmit={(e) => void onSaveEdit(e)}>
              <label>
                Title *
                <input
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Note
                <textarea
                  value={edit.note}
                  onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                  rows={3}
                  disabled={busy}
                />
              </label>
              <label>
                Optional Tag
                <select
                  value={edit.tag_id}
                  onChange={(e) => setEdit({ ...edit, tag_id: e.target.value })}
                  disabled={busy}
                >
                  <option value="">없음</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="row end">
                <button type="button" className="btn ghost" onClick={closeEdit} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
