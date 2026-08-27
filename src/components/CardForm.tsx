import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Assessment, AssessmentType, Owner } from '../types'
import { uid } from '../sync'

interface FormProps {
  initial?: Assessment | null
  onClose: () => void
  onSave: (item: Assessment) => void
  onDelete?: (id: string) => void
}

const empty = {
  subject: '',
  short: '',
  professor: '',
  type: 'exam' as AssessmentType,
  owners: ['D'] as Owner[],
  note: '',
}

export function CardForm({ initial, onClose, onSave, onDelete }: FormProps) {
  const titleId = useId()
  const [form, setForm] = useState(() =>
    initial
      ? {
          subject: initial.subject,
          short: initial.short,
          professor: initial.professor,
          type: initial.type,
          owners: [...initial.owners] as Owner[],
          note: initial.note ?? '',
        }
      : empty,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleOwner(owner: Owner) {
    setForm((prev) => {
      const has = prev.owners.includes(owner)
      if (has && prev.owners.length === 1) return prev
      return {
        ...prev,
        owners: has
          ? prev.owners.filter((o) => o !== owner)
          : [...prev.owners, owner],
      }
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.professor.trim()) return

    const short =
      form.short.trim() ||
      form.subject
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase()

    const owners = [...form.owners].sort() as Owner[]
    const column =
      initial?.column ??
      (owners.includes('D') && owners.includes('M')
        ? 'shared'
        : owners[0] === 'D'
          ? 'd'
          : 'm')

    onSave({
      id: initial?.id ?? uid(),
      subject: form.subject.trim(),
      short,
      professor: form.professor.trim(),
      type: form.type,
      owners,
      column: initial?.column === 'done' ? 'done' : column,
      note: form.note.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{initial ? 'Редактировать' : 'Новая карточка'}</h2>
        <p className="modal__hint">1 экзамен / зачёт = 1 карточка</p>

        <label>
          Предмет
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
            autoFocus
            placeholder="Математический анализ"
          />
        </label>

        <label>
          Код
          <input
            value={form.short}
            onChange={(e) => setForm({ ...form, short: e.target.value })}
            placeholder="MAT"
            maxLength={6}
          />
        </label>

        <label>
          Преподаватель
          <input
            value={form.professor}
            onChange={(e) => setForm({ ...form, professor: e.target.value })}
            required
            placeholder="Иванова Е.П."
          />
        </label>

        <fieldset>
          <legend>Тип</legend>
          <label className="radio">
            <input
              type="radio"
              checked={form.type === 'exam'}
              onChange={() => setForm({ ...form, type: 'exam' })}
            />
            экзамен
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={form.type === 'credit'}
              onChange={() => setForm({ ...form, type: 'credit' })}
            />
            зачёт
          </label>
        </fieldset>

        <fieldset>
          <legend>Кому нужно</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={form.owners.includes('D')}
              onChange={() => toggleOwner('D')}
            />
            D
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.owners.includes('M')}
              onChange={() => toggleOwner('M')}
            />
            M
          </label>
        </fieldset>

        <label>
          Заметка
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="опционально"
          />
        </label>

        <div className="modal__actions">
          {initial && onDelete && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(initial.id)}
            >
              Удалить
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  )
}
