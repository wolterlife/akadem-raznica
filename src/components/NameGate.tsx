import { useEffect, useId, useState, type FormEvent } from 'react'
import { saveIdentity, type Identity } from '../presence'

const SUGGESTIONS = ['D', 'M', 'Денис', 'Макс', 'Гость']

interface Props {
  onReady: (identity: Identity) => void
}

export function NameGate({ onReady }: Props) {
  const titleId = useId()
  const [name, setName] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* stay until named */
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onReady(saveIdentity(trimmed))
  }

  return (
    <div className="modal-backdrop name-gate" role="presentation">
      <form className="modal" onSubmit={submit} aria-labelledby={titleId}>
        <h2 id={titleId}>Кто за доской?</h2>
        <p className="modal__hint">
          Имя видно другим онлайн. Потом можно сменить через кнопку профиля.
        </p>
        <label>
          Прозвище
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={24}
            placeholder="D / M / …"
          />
        </label>
        <div className="name-gate__chips">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => setName(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="modal__actions">
          <button type="submit" className="btn btn--primary">
            Войти
          </button>
        </div>
      </form>
    </div>
  )
}
