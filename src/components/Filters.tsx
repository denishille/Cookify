import type { Category, Diet } from '../types'
import { CATEGORY_LABELS, DIET_LABELS } from '../types'
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

/** Der Konfigurator: drei Dropdowns – Ernährung, Kategorie, Dauer. */
export function FilterGroups({ value, onChange, hasRatings }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const diet = value.topRated ? 'top' : (value.diets[0] ?? '')
  return (
    <div className="cfg">
      <select className={`select ${diet ? 'on' : ''}`} value={diet} aria-label="Ernährung"
        onChange={(e) => { const v = e.target.value; set(v === 'top' ? { diets: [], topRated: true } : { diets: v ? [v as Diet] : [], topRated: false }) }}>
        <option value="">Ernährung</option>
        {(Object.keys(DIET_LABELS) as Diet[]).map((d) => <option key={d} value={d}>{DIET_LABELS[d]}</option>)}
        {hasRatings && <option value="top">★ Top bewertet</option>}
      </select>
      <select className={`select ${value.category ? 'on' : ''}`} value={value.category} onChange={(e) => set({ category: e.target.value as Category | '' })} aria-label="Kategorie">
        <option value="">Kategorie</option>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
      </select>
      <select className={`select ${value.maxTime ? 'on' : ''}`} value={value.maxTime} onChange={(e) => set({ maxTime: Number(e.target.value) })} aria-label="Dauer">
        <option value={0}>Dauer</option>
        <option value={15}>bis 15 Min</option>
        <option value={30}>bis 30 Min</option>
        <option value={45}>bis 45 Min</option>
        <option value={60}>bis 60 Min</option>
      </select>
      {!isEmpty(value) && <button className="btn ghost" onClick={() => onChange(EMPTY_FILTERS)}>Zurücksetzen</button>}
    </div>
  )
}
