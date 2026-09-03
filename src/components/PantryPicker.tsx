import { useMemo, useState } from 'react'
import { INGREDIENT_GROUPS, INGREDIENT_BY_KEY } from '../data'
import { INGREDIENT_GROUP_LABELS } from '../types'

interface Props {
  pantry: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
  onReplace: (keys: string[]) => void
}

const PRESETS: { label: string; keys: string[] }[] = [
  { label: '🧅 Grundvorrat', keys: ['zwiebel', 'knoblauch', 'eier', 'milch', 'butter', 'sahne', 'joghurt', 'parmesan', 'mehl', 'speisestaerke', 'zucker', 'honig', 'reis', 'nudeln', 'spaghetti', 'kartoffel', 'haferflocken', 'tomaten-dose', 'tomatenmark', 'gemuesebruehe', 'sojasauce', 'senf', 'zitrone', 'petersilie'] },
  { label: '🥦 Gemüsekiste', keys: ['karotte', 'paprika', 'zucchini', 'brokkoli', 'tomate', 'gurke', 'spinat', 'champignons', 'salat', 'zwiebel'] },
  { label: '🍗 Protein-Woche', keys: ['haehnchenbrust', 'eier', 'quark', 'skyr', 'lachs', 'kichererbsen', 'tofu', 'haferflocken', 'brokkoli', 'reis'] },
]

export function PantryPicker({ pantry, onToggle, onClear, onReplace }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.values(INGREDIENT_GROUPS)
      .flat()
      .filter((i) => i.name.toLowerCase().includes(q) || i.key.includes(q))
      .slice(0, 12)
  }, [query])

  const selected = [...pantry].map((k) => INGREDIENT_BY_KEY.get(k)).filter(Boolean)

  return (
    <div className="panel">
      <div className="filter-label" style={{ marginBottom: 8 }}>Was hast du zuhause?</div>
      <input
        className="input"
        placeholder="Zutat suchen, z. B. Hähnchen, Reis, Feta …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            onToggle(results[0].key)
            setQuery('')
          }
        }}
      />
      {results.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {results.map((i) => (
            <button key={i.key} className={`chip small ${pantry.has(i.key) ? 'on green' : ''}`}
              onClick={() => { onToggle(i.key); setQuery('') }}>
              {i.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
        <span className="filter-label">Dein Vorrat ({selected.length})</span>
        {selected.length > 0 && <button className="btn ghost small" onClick={onClear}>Leeren</button>}
      </div>
      <div className="selected-box">
        {selected.length === 0 ? (
          <span className="hint">Noch nichts ausgewählt. Tippe Zutaten an oder nimm ein Set:</span>
        ) : (
          <div className="chips">
            {selected.map((i) => i && (
              <button key={i.key} className="chip small on green" onClick={() => onToggle(i.key)} title="Entfernen">
                {i.name} ✕
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="chip small" onClick={() => onReplace([...pantry, ...p.keys])}>{p.label}</button>
        ))}
      </div>
      <p className="hint" style={{ margin: '10px 0 0' }}>
        Salz, Pfeffer, Öl und gängige Gewürze zählen als Grundvorrat und müssen nicht ausgewählt werden.
      </p>

      {Object.entries(INGREDIENT_GROUPS).map(([group, items]) => {
        if (group === 'kraeuter-gewuerze') {
          items = items.filter((i) => !i.staple)
        }
        const n = items.filter((i) => pantry.has(i.key)).length
        return (
          <details key={group} className="pantry-group" open={group === 'gemuese'}>
            <summary>
              <span>{INGREDIENT_GROUP_LABELS[group] ?? group}{n > 0 && <span className="pill" style={{ marginLeft: 8 }}>{n}</span>}</span>
            </summary>
            <div className="chips">
              {items.map((i) => (
                <button key={i.key} className={`chip small ${pantry.has(i.key) ? 'on green' : ''}`} onClick={() => onToggle(i.key)}>
                  {i.name}
                </button>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
