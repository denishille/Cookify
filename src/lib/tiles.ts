import type { Category } from '../types'

/** Pastellfarbe der Bildkachel je Kategorie (Ersatz für Food-Fotografie). */
export const TILE_COLORS: Record<Category, string> = {
  hauptgericht: '#fbe3cf',
  suppe: '#ffe9b8',
  salat: '#dcefd4',
  fruehstueck: '#fff0cc',
  snack: '#ece2f5',
  nachspeise: '#fadde4',
  backen: '#f3e4d0',
}
