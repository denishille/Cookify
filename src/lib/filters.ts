import type { Category, Cuisine, Diet, Difficulty } from '../types'

export interface FilterState {
  category: Category | ''
  diets: Diet[]
  cuisine: Cuisine | ''
  maxTime: number
  difficulty: Difficulty | ''
}

export const EMPTY_FILTERS: FilterState = { category: '', diets: [], cuisine: '', maxTime: 0, difficulty: '' }

export function applyFilters<T extends { category: Category; diet: Diet[]; cuisine: Cuisine; timeMinutes: number; difficulty: Difficulty }>(items: T[], f: FilterState): T[] {
  return items.filter((r) =>
    (!f.category || r.category === f.category) &&
    f.diets.every((d) => r.diet.includes(d)) &&
    (!f.cuisine || r.cuisine === f.cuisine) &&
    (!f.maxTime || r.timeMinutes <= f.maxTime) &&
    (!f.difficulty || r.difficulty === f.difficulty),
  )
}

/** Anzahl aktiver Kriterien, für die Zahl am Filter-Button. */
export function activeCount(f: FilterState): number {
  return (f.category ? 1 : 0) + f.diets.length + (f.cuisine ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.difficulty ? 1 : 0)
}

export function isEmpty(f: FilterState): boolean {
  return activeCount(f) === 0
}

/** Schnellfilter-Chips: jeder setzt genau einen Filterzustand. */
export interface QuickFilter {
  id: string
  label: string
  state: FilterState
}

const q = (id: string, label: string, patch: Partial<FilterState>): QuickFilter => ({ id, label, state: { ...EMPTY_FILTERS, ...patch } })

export const QUICK_FILTERS: QuickFilter[] = [
  q('vegetarisch', 'Vegetarisch', { diets: ['vegetarisch'] }),
  q('vegan', 'Vegan', { diets: ['vegan'] }),
  q('schnell', 'Unter 30 Min', { maxTime: 30 }),
  q('protein', 'Proteinreich', { diets: ['proteinreich'] }),
  q('leicht', 'Kalorienarm', { diets: ['kalorienarm'] }),
  q('fruehstueck', 'Frühstück', { category: 'fruehstueck' }),
  q('nachspeise', 'Nachspeisen', { category: 'nachspeise' }),
  q('suppe', 'Suppen', { category: 'suppe' }),
  q('salat', 'Salate', { category: 'salat' }),
]

export function sameFilters(a: FilterState, b: FilterState): boolean {
  return a.category === b.category && a.cuisine === b.cuisine && a.maxTime === b.maxTime && a.difficulty === b.difficulty &&
    a.diets.length === b.diets.length && a.diets.every((d) => b.diets.includes(d))
}
