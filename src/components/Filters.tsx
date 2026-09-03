import type { Category, Cuisine, Diet, Difficulty } from '../types'
import { CATEGORY_LABELS, CUISINE_LABELS, DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import { EMPTY_FILTERS, type FilterState } from '../lib/filters'

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  compact?: boolean
}

export function Filters({ value, onChange, compact }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const toggleDiet = (d: Diet) =>
    set({ diets: value.diets.includes(d) ? value.diets.filter((x) => x !== d) : [...value.diets, d] })
  const active = value.category || value.diets.length || value.cuisine || value.maxTime || value.difficulty

  return (
    <div>
      <div className="filter-row">
        <span className="filter-label">Ernährung</span>
        <div className="chips">
          {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
            <button key={d} className={`chip ${value.diets.includes(d) ? 'on' : ''}`} onClick={() => toggleDiet(d)}>
              {DIET_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="filter-label">Kategorie</span>
        <div className="chips">
          <button className={`chip ${value.category === '' ? 'on' : ''}`} onClick={() => set({ category: '' })}>Alle</button>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <button key={c} className={`chip ${value.category === c ? 'on' : ''}`} onClick={() => set({ category: value.category === c ? '' : c })}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="toolbar">
          <select className="select" value={value.cuisine} onChange={(e) => set({ cuisine: e.target.value as Cuisine | '' })}>
            <option value="">Alle Küchen</option>
            {(Object.keys(CUISINE_LABELS) as Cuisine[]).map((c) => <option key={c} value={c}>{CUISINE_LABELS[c]}</option>)}
          </select>
          <select className="select" value={value.maxTime} onChange={(e) => set({ maxTime: Number(e.target.value) })}>
            <option value={0}>Beliebige Dauer</option>
            <option value={15}>bis 15 Min</option>
            <option value={30}>bis 30 Min</option>
            <option value={45}>bis 45 Min</option>
            <option value={60}>bis 60 Min</option>
          </select>
          <select className="select" value={value.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty | '' })}>
            <option value="">Jede Schwierigkeit</option>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          {active ? <button className="btn ghost small" onClick={() => onChange(EMPTY_FILTERS)}>Filter zurücksetzen</button> : null}
        </div>
      )}
    </div>
  )
}
