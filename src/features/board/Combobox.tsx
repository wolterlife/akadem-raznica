import { useEffect, useId, useMemo, useRef, useState } from 'react'

interface Props {
  label: string
  value: string
  options: string[]
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  allowCreate?: boolean
  onChange: (value: string) => void
}

export function Combobox({
  label,
  value,
  options,
  placeholder,
  required,
  autoFocus,
  allowCreate = true,
  onChange,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (!open) return

    function closeIfOutside(target: EventTarget | null) {
      if (!rootRef.current?.contains(target as Node)) setOpen(false)
    }

    function onPointerDown(e: PointerEvent) {
      closeIfOutside(e.target)
    }

    function onMouseDown(e: MouseEvent) {
      closeIfOutside(e.target)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }

    // capture: modal calls stopPropagation on bubble
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 12)
    return options
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, 12)
  }, [options, query])

  const exact = options.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase(),
  )
  const showCreate = allowCreate && query.trim().length > 0 && !exact
  const showList = open && (filtered.length > 0 || showCreate)

  function pick(next: string) {
    onChange(next)
    setQuery(next)
    setOpen(false)
  }

  return (
    <div className="combo" ref={rootRef}>
      <label className="combo__label">
        {label}
        <input
          value={query}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setOpen(true)
          }}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null
            if (!rootRef.current?.contains(next)) setOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
            if (e.key === 'Enter' && open && filtered[0]) {
              e.preventDefault()
              pick(filtered[0])
            }
          }}
        />
      </label>
      {showList && (
        <ul id={listId} className="combo__list" role="listbox">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                tabIndex={-1}
                className="combo__option"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                tabIndex={-1}
                className="combo__option combo__option--create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(query.trim())}
              >
                + добавить «{query.trim()}»
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
