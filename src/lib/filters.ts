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
