import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import type { Assessment, AssessmentType, Owner } from '../../types'
import { TYPE_LABEL } from '../../types'
import { uid } from '../../sync'

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

const TYPE_OPTIONS = Object.entries(TYPE_LABEL) as [AssessmentType, string][]

export function CardForm({ initial, onClose, onSave, onDelete }: FormProps) {
  const titleId = useId()
  const closeOnBackdrop = useRef(false)
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
        <h2 id={titleId}>{initial ? 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ' : 'РќРѕРІР°СЏ РєР°СЂС‚РѕС‡РєР°'}</h2>
        <p className="modal__hint">1 РїРѕР·РёС†РёСЏ РёР· Р»РёСЃС‚Р° = 1 РєР°СЂС‚РѕС‡РєР°</p>

        <label>
          РџСЂРµРґРјРµС‚
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
            autoFocus
            placeholder="РњР°С‚РµРјР°С‚РёС‡РµСЃРєРёР№ Р°РЅР°Р»РёР·"
          />
        </label>

        <label>
          РљРѕРґ
          <input
            value={form.short}
            onChange={(e) => setForm({ ...form, short: e.target.value })}
            placeholder="РњРђРўРђРќ"
            maxLength={6}
          />
        </label>

        <label>
          РџСЂРµРїРѕРґР°РІР°С‚РµР»СЊ
          <input
            value={form.professor}
            onChange={(e) => setForm({ ...form, professor: e.target.value })}
            placeholder="РРІР°РЅРѕРІР° Р•.Рџ."
          />
        </label>

        <label>
          РўРёРї
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
          <legend>РљРѕРјСѓ РЅСѓР¶РЅРѕ</legend>
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
          Р—Р°РјРµС‚РєР°
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ"
          />
        </label>

        <div className="modal__actions">
          {initial && onDelete && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(initial.id)}
            >
              РЈРґР°Р»РёС‚СЊ
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            РћС‚РјРµРЅР°
          </button>
          <button type="submit" className="btn btn--primary">
            РЎРѕС…СЂР°РЅРёС‚СЊ
          </button>
        </div>
      </form>
    </div>
  )
}

