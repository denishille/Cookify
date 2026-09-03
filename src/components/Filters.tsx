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

/** Der Konfigurator: alle Filtergruppen als Chips, sauber in Gruppen aufgeteilt. */
export function FilterGroups({ value, onChange, hasRatings }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const toggleDiet = (d: Diet) =>
    set({ diets: value.diets.includes(d) ? value.diets.filter((x) => x !== d) : [...value.diets, d] })
  const TIMES: [number, string][] = [[15, 'bis 15 Min'], [30, 'bis 30 Min'], [45, 'bis 45 Min'], [60, 'bis 60 Min']]

  return (
    <div className="config-grid">
      <div className="filter-row">
        <span className="eyebrow">Ernährung</span>
        <div className="chips">
          {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
            <button key={d} className={`chip ${value.diets.includes(d) ? 'on' : ''}`} onClick={() => toggleDiet(d)}>{DIET_LABELS[d]}</button>
          ))}
          {hasRatings && (
            <button className={`chip ${value.topRated ? 'on' : ''}`} onClick={() => set({ topRated: !value.topRated })}>★ Top bewertet</button>
          )}
        </div>
      </div>
      <div className="filter-row">
        <span className="eyebrow">Kategorie</span>
        <div className="chips">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <button key={c} className={`chip ${value.category === c ? 'on' : ''}`} onClick={() => set({ category: value.category === c ? '' : c })}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="eyebrow">Küche</span>
        <div className="chips">
          {(Object.keys(CUISINE_LABELS) as Cuisine[]).map((c) => (
            <button key={c} className={`chip ${value.cuisine === c ? 'on' : ''}`} onClick={() => set({ cuisine: value.cuisine === c ? '' : c })}>{CUISINE_LABELS[c]}</button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="eyebrow">Dauer</span>
        <div className="chips">
          {TIMES.map(([t, label]) => (
            <button key={t} className={`chip ${value.maxTime === t ? 'on' : ''}`} onClick={() => set({ maxTime: value.maxTime === t ? 0 : t })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="eyebrow">Schwierigkeit</span>
        <div className="chips">
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <button key={d} className={`chip ${value.difficulty === d ? 'on' : ''}`} onClick={() => set({ difficulty: value.difficulty === d ? '' : d })}>{DIFFICULTY_LABELS[d]}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
