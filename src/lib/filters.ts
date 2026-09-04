import type { Category, Cuisine, Diet, Difficulty, Recipe } from '../types'
import { CATEGORY_LABELS, CUISINE_LABELS } from '../types'
import { adaptRecipe, type DietOptions } from './adapt'

export interface FilterState {
  category: Category | ''
  diets: Diet[]
  cuisine: Cuisine | ''
  maxTime: number
  difficulty: Difficulty | ''
  /** Freitextsuche über Titel, Beschreibung, Zutaten und Tags */
  query: string
}

export const EMPTY_FILTERS: FilterState = { category: '', diets: [], cuisine: '', maxTime: 0, difficulty: '', query: '' }

export function applyFilters(items: Recipe[], f: FilterState, opts: DietOptions = {}): Recipe[] {
  return items.filter((r) =>
    (!f.category || r.category === f.category) &&
    adaptRecipe(r, f.diets, opts).ok &&
    (!f.cuisine || r.cuisine === f.cuisine) &&
    (!f.maxTime || r.timeMinutes <= f.maxTime) &&
    (!f.difficulty || r.difficulty === f.difficulty) &&
    matchesQuery(r, f.query),
  )
}

/** Vergleichsform ohne Umlaute und Sonderzeichen, damit „Grunkohl“ auch Grünkohl findet. */
const norm = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

/** Sucht in Titel, Beschreibung, Zutaten, Tags, Kategorie und Küche. Alle Wörter müssen vorkommen. */
export function matchesQuery(r: Recipe, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = norm([
    r.title, r.description, r.tags.join(' '), r.ingredients.map((i) => i.name).join(' '),
    CATEGORY_LABELS[r.category], CUISINE_LABELS[r.cuisine],
  ].join(' '))
  return words.every((w) => haystack.includes(w))
}

/** Treffer im Titel zuerst, dann alphabetisch. */
export function rankByQuery(items: Recipe[], query: string): Recipe[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  const score = (r: Recipe) => {
    const t = norm(r.title)
    if (words.every((w) => t.includes(w))) return t.startsWith(words[0]) ? 0 : 1
    return 2
  }
  return [...items].sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title, 'de'))
}

/** Anzahl aktiver Kriterien, für die Zahl am Filter-Button. */
export function activeCount(f: FilterState): number {
  return (f.category ? 1 : 0) + f.diets.length + (f.cuisine ? 1 : 0) + (f.maxTime ? 1 : 0) + (f.difficulty ? 1 : 0) + (f.query.trim() ? 1 : 0)
}

export function isEmpty(f: FilterState): boolean {
  return activeCount(f) === 0
}
