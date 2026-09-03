export type Category =
  | 'hauptgericht' | 'vorspeise' | 'suppe' | 'salat' | 'beilage'
  | 'fruehstueck' | 'snack' | 'nachspeise' | 'backen' | 'getraenk'

export type Cuisine =
  | 'deutsch' | 'italienisch' | 'asiatisch' | 'indisch' | 'mexikanisch'
  | 'mediterran' | 'amerikanisch' | 'orientalisch' | 'franzoesisch' | 'international'

export type Diet =
  | 'vegetarisch' | 'vegan' | 'glutenfrei' | 'laktosefrei'
  | 'proteinreich' | 'lowcarb' | 'kalorienarm'

export type Difficulty = 'einfach' | 'mittel' | 'anspruchsvoll'

export interface Ingredient {
  key: string
  name: string
  amount: number | null
  unit: string
  optional?: boolean
}

export interface Nutrition {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Recherchierte Quelle: ein passendes, gut bewertetes Originalrezept auf einer bekannten Seite. */
export interface RecipeSource {
  site: string
  url: string
  title?: string
  rating?: number
  ratingCount?: number
}

export interface Recipe {
  id: string
  title: string
  description: string
  emoji: string
  category: Category
  cuisine: Cuisine
  diet: Diet[]
  timeMinutes: number
  difficulty: Difficulty
  servings: number
  nutrition: Nutrition
  ingredients: Ingredient[]
  steps: string[]
  tags: string[]
  /** ISO-Woche (z. B. "2026-W36"), ab der das Rezept in der App sichtbar ist. */
  addedWeek: string
  source?: RecipeSource
}

export interface IngredientDef {
  key: string
  name: string
  staple?: boolean
}

export const CATEGORY_LABELS: Record<Category, string> = {
  hauptgericht: 'Hauptgericht',
  vorspeise: 'Vorspeise',
  suppe: 'Suppe',
  salat: 'Salat',
  beilage: 'Beilage',
  fruehstueck: 'Frühstück',
  snack: 'Snack',
  nachspeise: 'Nachspeise',
  backen: 'Backen',
  getraenk: 'Getränk',
}

export const CUISINE_LABELS: Record<Cuisine, string> = {
  deutsch: 'Deutsch',
  italienisch: 'Italienisch',
  asiatisch: 'Asiatisch',
  indisch: 'Indisch',
  mexikanisch: 'Mexikanisch',
  mediterran: 'Mediterran',
  amerikanisch: 'Amerikanisch',
  orientalisch: 'Orientalisch',
  franzoesisch: 'Französisch',
  international: 'International',
}

export const DIET_LABELS: Record<Diet, string> = {
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
  proteinreich: 'Proteinreich',
  lowcarb: 'Low Carb',
  kalorienarm: 'Kalorienarm',
  glutenfrei: 'Glutenfrei',
  laktosefrei: 'Laktosefrei',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  einfach: 'Einfach',
  mittel: 'Mittel',
  anspruchsvoll: 'Anspruchsvoll',
}

export const INGREDIENT_GROUP_LABELS: Record<string, string> = {
  gemuese: 'Gemüse',
  obst: 'Obst',
  fleisch: 'Fleisch',
  fisch: 'Fisch & Meeresfrüchte',
  milchprodukte: 'Milchprodukte & Eier',
  pflanzlich: 'Pflanzliche Alternativen',
  huelsenfruechte: 'Hülsenfrüchte',
  getreide: 'Getreide, Nudeln & Brot',
  'nuesse-samen': 'Nüsse & Samen',
  vorrat: 'Vorrat & Saucen',
  'kraeuter-gewuerze': 'Kräuter & Gewürze',
}
