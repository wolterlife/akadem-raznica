import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import type { Assessment, AssessmentType, Owner } from '../../types'
import { TYPE_LABEL } from '../../types'
import { uid } from '../../sync'
import { Combobox } from './Combobox'
import { ProfessorPhotoButton } from './ProfessorPhoto'
import { notesPayload } from './progress'

interface FormProps {
  initial?: Assessment | null
  subjects: string[]
  professors: string[]
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
  noteD: '',
  noteM: '',
  pending: false,
}

const TYPE_OPTIONS = Object.entries(TYPE_LABEL) as [AssessmentType, string][]

function initialForm(initial?: Assessment | null) {
  if (!initial) return empty
  const noteD =
    initial.notes?.D ??
    (initial.owners.includes('D') ? (initial.note ?? '') : '')
  const noteM =
    initial.notes?.M ??
    (initial.owners.includes('M') ? (initial.note ?? '') : '')
  return {
    subject: initial.subject,
    short: initial.short,
    professor: initial.professor,
    type: initial.type,
    owners: [...initial.owners] as Owner[],
    noteD,
    noteM,
    pending: Boolean(initial.pending),
  }
}

export function CardForm({
  initial,
  subjects,
  professors,
  onClose,
  onSave,
  onDelete,
}: FormProps) {
  const titleId = useId()
  const closeOnBackdrop = useRef(false)
  const [form, setForm] = useState(() => initialForm(initial))

  const both = form.owners.includes('D') && form.owners.includes('M')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onBackdropPointerDown(e: MouseEvent<HTMLDivElement>) {
    closeOnBackdrop.current = e.target === e.currentTarget
  }

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && closeOnBackdrop.current) onClose()
    closeOnBackdrop.current = false
  }

  function toggleOwner(owner: Owner) {
    setForm((prev) => {
      const has = prev.owners.includes(owner)
      if (has && prev.owners.length === 1) return prev
      const owners = has
        ? prev.owners.filter((o) => o !== owner)
        : [...prev.owners, owner]
      return {
        ...prev,
        owners,
      }
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.subject.trim()) return

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
    const doneBy = (initial?.doneBy ?? []).filter((o) => owners.includes(o))
    const column =
      initial?.column && owners.includes(initial.column === 'm' ? 'M' : 'D')
        ? initial.column
        : owners.includes('D')
          ? 'd'
          : 'm'

    onSave({
      id: initial?.id ?? uid(),
      subject: form.subject.trim(),
      short,
      professor: form.professor.trim(),
      type: form.type,
      owners,
      column: initial?.column === 'done' ? 'done' : column,
      doneBy,
      ...(form.pending ? { pending: true } : {}),
      ...notesPayload(owners, form.noteD, form.noteM),
    })
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onBackdropPointerDown}
      onClick={onBackdropClick}
      role="presentation"
    >
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{initial ? 'Редактировать' : 'Новая карточка'}</h2>
        <p className="modal__hint">
          Если предмет нужен обоим — отметь D и M. Каждый закрывает его из
          своего столбца переносом в Done.
        </p>

        <Combobox
          label="Предмет"
          value={form.subject}
          options={subjects}
          required
          placeholder="Начни писать…"
          onChange={(subject) => setForm({ ...form, subject })}
        />

        <label>
          Код
          <input
            value={form.short}
            onChange={(e) => setForm({ ...form, short: e.target.value })}
            placeholder="МАТАН"
            maxLength={6}
          />
        </label>

        <div className="modal__prof">
          <Combobox
            label="Преподаватель"
            value={form.professor}
            options={professors}
            placeholder="????? ????? если неизвестен"
            onChange={(professor) => setForm({ ...form, professor })}
          />
          <ProfessorPhotoButton name={form.professor} variant="form" />
        </div>

        <label>
          Тип
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as AssessmentType })
            }
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

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

        <label className="check">
          <input
            type="checkbox"
            checked={form.pending}
            onChange={() => setForm({ ...form, pending: !form.pending })}
          />
          под вопросом
        </label>
        <p className="modal__hint">
          Не факт, что придётся сдавать — зависит от решения преподавателя.
        </p>

        {both ? (
          <>
            <label>
              Заметка D
              <textarea
                rows={3}
                value={form.noteD}
                onChange={(e) => setForm({ ...form, noteD: e.target.value })}
                placeholder="условия сдачи для D"
              />
            </label>
            <label>
              Заметка M
              <textarea
                rows={3}
                value={form.noteM}
                onChange={(e) => setForm({ ...form, noteM: e.target.value })}
                placeholder="условия сдачи для M"
              />
            </label>
          </>
        ) : (
          <label>
            Заметка
            <textarea
              rows={3}
              value={form.owners.includes('M') ? form.noteM : form.noteD}
              onChange={(e) =>
                form.owners.includes('M')
                  ? setForm({ ...form, noteM: e.target.value })
                  : setForm({ ...form, noteD: e.target.value })
              }
              placeholder="условия сдачи, несколько строк"
            />
          </label>
        )}

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
