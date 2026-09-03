import type { Category, Cuisine, Diet, Difficulty } from '../types'
import { CATEGORY_LABELS, CUISINE_LABELS, DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import { EMPTY_FILTERS, QUICK_FILTERS, isEmpty, sameFilters, type FilterState } from '../lib/filters'

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  /** Bewertungsfilter nur anbieten, wenn es bewertete Rezepte gibt */
  hasRatings?: boolean
}

/** Eine Zeile Schnellfilter-Chips. Ein Chip setzt genau einen Zustand, „Alle“ setzt zurück. */
export function QuickFilters({ value, onChange, hasRatings }: Props) {
  return (
    <div className="chips scroll" role="group" aria-label="Schnellfilter">
      <button className={`chip ${isEmpty(value) ? 'on' : ''}`} onClick={() => onChange(EMPTY_FILTERS)}>Alle</button>
      {QUICK_FILTERS.filter((qf) => hasRatings || !qf.state.topRated).map((qf) => {
        const on = sameFilters(value, qf.state)
        return (
          <button key={qf.id} className={`chip ${on ? 'on' : ''}`} onClick={() => onChange(on ? EMPTY_FILTERS : qf.state)}>
            {qf.label}
          </button>
        )
      })}
    </div>
  )
}

/** Der Konfigurator: kompakt, Label links, kleine Chips, drei schmale Auswahlfelder. */
export function FilterGroups({ value, onChange, hasRatings }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const toggleDiet = (d: Diet) =>
    set({ diets: value.diets.includes(d) ? value.diets.filter((x) => x !== d) : [...value.diets, d] })

  return (
    <div className="cfg">
      <div className="cfg-row">
        <span className="cfg-label">Ernährung</span>
        <div className="chips">
          {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
            <button key={d} className={`chip sm ${value.diets.includes(d) ? 'on' : ''}`} onClick={() => toggleDiet(d)}>{DIET_LABELS[d]}</button>
          ))}
          {hasRatings && (
            <button className={`chip sm ${value.topRated ? 'on' : ''}`} onClick={() => set({ topRated: !value.topRated })}>★ Top bewertet</button>
          )}
        </div>
      </div>
      <div className="cfg-row">
        <span className="cfg-label">Kategorie</span>
        <div className="chips">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <button key={c} className={`chip sm ${value.category === c ? 'on' : ''}`} onClick={() => set({ category: value.category === c ? '' : c })}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>
      </div>
      <div className="cfg-row">
        <span className="cfg-label">Weitere</span>
        <div className="cfg-selects">
          <select className={`select sm ${value.cuisine ? 'on' : ''}`} value={value.cuisine} onChange={(e) => set({ cuisine: e.target.value as Cuisine | '' })} aria-label="Küche">
            <option value="">Küche</option>
            {(Object.keys(CUISINE_LABELS) as Cuisine[]).map((c) => <option key={c} value={c}>{CUISINE_LABELS[c]}</option>)}
          </select>
          <select className={`select sm ${value.maxTime ? 'on' : ''}`} value={value.maxTime} onChange={(e) => set({ maxTime: Number(e.target.value) })} aria-label="Dauer">
            <option value={0}>Dauer</option>
            <option value={15}>bis 15 Min</option>
            <option value={30}>bis 30 Min</option>
            <option value={45}>bis 45 Min</option>
            <option value={60}>bis 60 Min</option>
          </select>
          <select className={`select sm ${value.difficulty ? 'on' : ''}`} value={value.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty | '' })} aria-label="Schwierigkeit">
            <option value="">Schwierigkeit</option>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          {!isEmpty(value) && <button className="btn sm ghost" onClick={() => onChange(EMPTY_FILTERS)}>Zurücksetzen</button>}
        </div>
      </div>
    </div>
  )
}
