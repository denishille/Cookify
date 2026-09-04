import type { Category, Cuisine, Diet, Difficulty, Recipe } from '../types'
import { isTopRated } from './rating'

export interface FilterState {
  category: Category | ''
  diets: Diet[]
  cuisine: Cuisine | ''
  maxTime: number
  difficulty: Difficulty | ''
  /** nur Rezepte, deren Quelle sehr gut und oft bewertet ist */
  topRated: boolean
}

export const EMPTY_FILTERS: FilterState = { category: '', diets: [], cuisine: '', maxTime: 0, difficulty: '', topRated: false }

export function applyFilters(items: Recipe[], f: FilterState): Recipe[] {
  return items.filter((r) =>
    (!f.category || r.category === f.category) &&
    f.diets.every((d) => r.diet.includes(d)) &&
    (!f.cuisine || r.cuisine === f.cuisine) &&
    (!f.maxTime || r.timeMinutes <= f.maxTime) &&
    (!f.difficulty || r.difficulty === f.difficulty) &&
    (!f.topRated || isTopRated(r)),
  )
}

/** Anzahl aktiver Kriterien, für die Zahl am Filter-Button. */
export function activeCount(f: FilterState): number {
  return (f.category ? 1 : 0) + f.diets.length + (f.cuisine ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.difficulty ? 1 : 0) + (f.topRated ? 1 : 0)
}

export function isEmpty(f: FilterState): boolean {
  return activeCount(f) === 0
}
