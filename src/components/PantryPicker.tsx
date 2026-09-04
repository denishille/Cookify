import { useMemo, useRef, useState } from 'react'
import { INGREDIENT_GROUPS, INGREDIENT_BY_KEY } from '../data'
import { INGREDIENT_GROUP_LABELS } from '../types'
import { IconChevronDown, IconSearch, IconX } from './Icons'

interface Props {
  pantry: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
}

export function PantryPicker({ pantry, onToggle, onClear }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  /** Zutat übernehmen, Feld leeren und den Fokus behalten, damit man direkt die nächste tippen kann. */
  const add = (key: string) => {
    if (!pantry.has(key)) onToggle(key)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.values(INGREDIENT_GROUPS).flat()
      .filter((i) => i.name.toLowerCase().includes(q) || i.key.includes(q))
      .slice(0, 10)
  }, [query])

  const selected = [...pantry].map((k) => INGREDIENT_BY_KEY.get(k)).filter((i) => i !== undefined)

  return (
    <div className="panel">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Zutat hinzufügen</div>
        <div className="searchbox">
          <IconSearch />
          <input
            ref={inputRef}
            placeholder="z. B. Hähnchen, Reis, Feta …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) { e.preventDefault(); add(results[0].key) }
              if (e.key === 'Escape') setQuery('')
            }}
            autoComplete="off"
            enterKeyHint="done"
            aria-label="Zutat suchen"
          />
          {query && <button className="clear" onClick={() => setQuery('')} aria-label="Suche löschen"><IconX width={16} height={16} /></button>}
        </div>
        {query && (
          <div className="chips" style={{ marginTop: 10 }}>
            {results.length === 0 && <span className="hint">Nichts gefunden.</span>}
            {results.map((i) => (
              <button key={i.key} className={`chip sm soft ${pantry.has(i.key) ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => add(i.key)}>
                {i.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="eyebrow">Im Vorrat · {selected.length}</span>
          {selected.length > 0 && <button className="btn sm" onClick={onClear}>Alles entfernen</button>}
        </div>
        <div className="pantry-selected">
          {selected.length === 0
            ? <span className="hint">Noch leer. Such oben eine Zutat und füge sie hinzu.</span>
            : selected.map((i) => (
              <button key={i.key} className="chip sm" onClick={() => onToggle(i.key)} aria-label={`${i.name} entfernen`}>
                {i.name} <span className="x"><IconX width={14} height={14} /></span>
              </button>
            ))}
        </div>
      </div>

      <details className="browse">
        <summary>Alle Zutaten nach Kategorie <IconChevronDown width={16} height={16} /></summary>
        {Object.entries(INGREDIENT_GROUPS).map(([group, items]) => {
          const list = items
          if (list.length === 0) return null
          return (
            <div key={group} className="group">
              <h4>{INGREDIENT_GROUP_LABELS[group] ?? group}</h4>
              <div className="chips">
                {list.map((i) => (
                  <button key={i.key} className={`chip sm soft ${pantry.has(i.key) ? 'on' : ''}`} onClick={() => onToggle(i.key)}>{i.name}</button>
                ))}
              </div>
            </div>
          )
        })}
      </details>
    </div>
  )
}
