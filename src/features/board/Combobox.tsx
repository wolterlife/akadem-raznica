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
  const rootRef = useRef<HTMLLabelElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

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
  const showCreate =
    allowCreate && query.trim().length > 0 && !exact

  function pick(next: string) {
    onChange(next)
    setQuery(next)
    setOpen(false)
  }

  return (
    <label className="combo" ref={rootRef}>
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
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter' && open && filtered[0]) {
            e.preventDefault()
            pick(filtered[0])
          }
        }}
      />
      {open && (filtered.length > 0 || showCreate) && (
        <ul id={listId} className="combo__list" role="listbox">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
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
    </label>
  )
}
