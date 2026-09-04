import { useMemo, useRef, useState } from 'react'
import { INGREDIENT_GROUPS } from '../data'
import { INGREDIENT_GROUP_LABELS, type Diet } from '../types'
import { excludedIngredientKeys, ingredientPlaceholder } from '../lib/dietIngredients'
import { IconChevronDown, IconSearch, IconX } from './Icons'

interface Props {
  selected: Set<string>
  onToggle: (key: string) => void
  /** Eingabefeld nach dem Hinzufügen fokussiert lassen (Zutaten in Folge tippen) */
  keepFocus?: boolean
  placeholder?: string
  /** Globale Ernährungsform: passende Zutaten werden gar nicht erst angeboten */
  diets?: readonly Diet[]
}

/** Zutatensuche plus eingeklappter Katalog aller Zutaten nach Kategorie. */
export function IngredientPicker({ selected, onToggle, keepFocus = true, placeholder, diets = [] }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const excluded = excludedIngredientKeys(diets)
  const groups = Object.entries(INGREDIENT_GROUPS)
    .map(([group, items]) => [group, items.filter((i) => !excluded.has(i.key))] as const)
    .filter(([, items]) => items.length > 0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return groups.flatMap(([, items]) => items)
      .filter((i) => i.name.toLowerCase().includes(q) || i.key.includes(q))
      .slice(0, 10)
  }, [query, groups])

  const add = (key: string) => {
    if (!selected.has(key)) onToggle(key)
    setQuery('')
    if (keepFocus) requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <>
      <div className="searchbox">
        <IconSearch />
        <input
          ref={inputRef}
          placeholder={placeholder ?? ingredientPlaceholder(diets)}
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
            <button key={i.key} className={`chip sm soft ${selected.has(i.key) ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => add(i.key)}>
              {i.name}
            </button>
          ))}
        </div>
      )}
      <details className="browse" style={{ marginTop: 12 }}>
        <summary>Alle Zutaten nach Kategorie <IconChevronDown width={16} height={16} /></summary>
        {groups.map(([group, items]) => (
          <div key={group} className="group">
            <h4>{INGREDIENT_GROUP_LABELS[group] ?? group}</h4>
            <div className="chips">
              {items.map((i) => (
                <button key={i.key} className={`chip sm soft ${selected.has(i.key) ? 'on' : ''}`} onClick={() => onToggle(i.key)}>{i.name}</button>
              ))}
            </div>
          </div>
        ))}
      </details>
    </>
  )
}
