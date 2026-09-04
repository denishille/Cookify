import { useEffect, useRef, useState } from 'react'
import type { Category, Diet } from '../types'
import { IconCheck, IconChevronDown } from './Icons'
import { CATEGORY_LABELS, DIET_LABELS } from '../types'
import { EMPTY_FILTERS, isEmpty, type FilterState } from '../lib/filters'

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  /** Bewertungsfilter nur anbieten, wenn es bewertete Rezepte gibt */
  hasRatings?: boolean
  /** Zusätzliche Felder, die vor den Filtern stehen */
  children?: React.ReactNode
  /** Kategorie-Feld ausblenden (Vorratsseite) */
  hideCategory?: boolean
  /** Dauer-Feld ausblenden (Alle-Rezepte-Liste sortiert stattdessen) */
  hideTime?: boolean
}

interface MultiOption { value: string; label: string }

/** Dropdown mit Mehrfachauswahl, sieht aus wie die Auswahlfelder daneben. */
function MultiSelect({ options, value, onChange, label }: { options: MultiOption[]; value: string[]; onChange: (next: string[]) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const chosen = options.filter((o) => value.includes(o.value))
  const text = chosen.length === 0 ? 'Alle' : chosen.length === 1 ? chosen[0].label : `${chosen.length} gewählt`
  return (
    <div className="multi" ref={ref}>
      <button type="button" className={`select multi-btn ${chosen.length ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={label}>
        <span>{text}</span><IconChevronDown width={16} height={16} />
      </button>
      {open && (
        <div className="multi-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
          <button type="button" className={`multi-item ${chosen.length === 0 ? 'on' : ''}`} role="option" aria-selected={chosen.length === 0} onClick={() => { onChange([]); setOpen(false) }}>
            <span className="box">{chosen.length === 0 && <IconCheck width={14} height={14} />}</span>Alle
          </button>
          {options.map((o) => {
            const on = value.includes(o.value)
            return (
              <button type="button" key={o.value} className={`multi-item ${on ? 'on' : ''}`} role="option" aria-selected={on} onClick={() => toggle(o.value)}>
                <span className="box">{on && <IconCheck width={14} height={14} />}</span>{o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Der Konfigurator: drei Dropdowns – Ernährung (Mehrfachauswahl), Kategorie, Dauer. */
export function FilterGroups({ value, onChange, hasRatings, children, hideCategory, hideTime }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const dietOptions: MultiOption[] = [
    ...(Object.keys(DIET_LABELS) as Diet[]).map((d) => ({ value: d, label: DIET_LABELS[d] })),
    ...(hasRatings ? [{ value: 'top', label: '★ Top bewertet' }] : []),
  ]
  const dietValue = [...value.diets, ...(value.topRated ? ['top'] : [])]
  return (
    <div className="cfg">
      {children}
      <div className="cfg-field">
        <span>Ernährung</span>
        <MultiSelect label="Ernährung" options={dietOptions} value={dietValue}
          onChange={(next) => set({ diets: next.filter((v) => v !== 'top') as Diet[], topRated: next.includes('top') })} />
      </div>
      {!hideCategory && (
        <label className="cfg-field">
          <span>Kategorie</span>
          <select className={`select ${value.category ? 'on' : ''}`} value={value.category} onChange={(e) => set({ category: e.target.value as Category | '' })}>
            <option value="">Alle</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
      )}
      {!hideTime && (
        <label className="cfg-field">
          <span>Dauer</span>
          <select className={`select ${value.maxTime ? 'on' : ''}`} value={value.maxTime} onChange={(e) => set({ maxTime: Number(e.target.value) })}>
            <option value={0}>Alle</option>
            <option value={15}>bis 15 Min</option>
            <option value={30}>bis 30 Min</option>
            <option value={45}>bis 45 Min</option>
            <option value={60}>bis 60 Min</option>
          </select>
        </label>
      )}
      {!isEmpty(value) && <button className="btn ghost cfg-reset" onClick={() => onChange(EMPTY_FILTERS)}>Zurücksetzen</button>}
    </div>
  )
}
