import { FormEvent, useState } from 'react'
import { completeFocusItem, createFocusItem } from '../../lib/api'
import type { CurrentFocusItem, Tag } from '../../lib/types'

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
  const [error, setError] = useState<string | null>(null)

  const openItems = items.filter((i) => i.status === 'open')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
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
    }
  }

  return (
    <section className="card section-now">
      <div className="page-header">
        <h2>NOW · Current Focus</h2>
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>
          + Focus 직접 추가
        </button>
      </div>
      <ul className="focus-list">
        {openItems.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            {item.note ? <span className="muted"> — {item.note}</span> : null}
            <button
              type="button"
              className="btn ghost small"
              onClick={() => void completeFocusItem(item.id).then(onChanged)}
            >
              Done
            </button>
          </li>
        ))}
        {openItems.length === 0 && <li className="muted">등록된 Focus 없음</li>}
      </ul>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Current Focus</h3>
            <form className="stack" onSubmit={(e) => void onSubmit(e)}>
              <label>
                Title *
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                Note
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </label>
              <label>
                Optional Tag (개념 연결만, Focus ≠ Tag)
                <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
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
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
