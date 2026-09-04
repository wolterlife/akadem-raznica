import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  lookupProfessor,
  professorPhotoUrl,
  professorSearchUrl,
  isUnknownProfessor,
  professorLabel,
} from '../../professors'

function stopDrag(e: PointerEvent | MouseEvent | TouchEvent) {
  e.stopPropagation()
}

export function ProfessorPhotoButton({
  name,
  variant = 'card',
}: {
  name: string
  variant?: 'card' | 'form'
}) {
  const [open, setOpen] = useState(false)
  const unknown = isUnknownProfessor(name)
  const label = professorLabel(name)
  const profile = unknown ? null : lookupProfessor(label)
  const photo = profile ? professorPhotoUrl(profile) : null
  const className =
    variant === 'form'
      ? `prof-face prof-face--form${unknown ? ' prof-face--unknown' : ''}`
      : `prof-face${unknown ? ' prof-face--unknown' : ''}`

  if (unknown) {
    return (
      <span
        className={className}
        title="Преподаватель неизвестен"
        aria-label="Преподаватель неизвестен"
      >
        <span className="prof-face__q" aria-hidden>
          ?
        </span>
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`Фото: ${label}`}
        title="Как выглядит"
        onPointerDown={stopDrag}
        onMouseDown={stopDrag}
        onTouchStart={stopDrag}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {photo ? (
          <img src={photo} alt="" />
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              fill="currentColor"
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.34 0-8 1.67-8 5v1.5h16V19c0-3.33-4.66-5-8-5z"
            />
          </svg>
        )}
      </button>
      {open
        ? createPortal(
            <ProfessorPhotoModal name={label} onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </>
  )
}

function ProfessorPhotoModal({
  name,
  onClose,
}: {
  name: string
  onClose: () => void
}) {
  const titleId = useId()
  const closeOnBackdrop = useRef(false)
  const profile = lookupProfessor(name)
  const photo = profile ? professorPhotoUrl(profile) : null
  const search = professorSearchUrl(name)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="modal-backdrop photo-modal"
      onMouseDown={(e) => {
        closeOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop.current) onClose()
        closeOnBackdrop.current = false
      }}
      role="presentation"
    >
      <div
        className="photo-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {photo ? (
          <img className="photo-sheet__img" src={photo} alt={name} />
        ) : (
          <div className="photo-sheet__empty">нет фото с сайта кафедры</div>
        )}
        <div className="photo-sheet__meta">
          <h2 id={titleId}>{profile?.name ?? name}</h2>
          {profile?.role ? <p>{profile.role}</p> : null}
          <div className="photo-sheet__links">
            {profile?.page ? (
              <a href={profile.page} target="_blank" rel="noreferrer">
                страница на кафедре
              </a>
            ) : null}
            <a href={search} target="_blank" rel="noreferrer">
              найти в картинках
            </a>
          </div>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
