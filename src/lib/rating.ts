import type { Recipe } from '../types'

/** Ab hier gilt ein Rezept als Community-Favorit. */
export const TOP_RATING = 4.5
export const TOP_COUNT = 50

export function isTopRated(r: Recipe): boolean {
  const s = r.source
  return !!s && s.rating !== undefined && s.ratingCount !== undefined && s.rating >= TOP_RATING && s.ratingCount >= TOP_COUNT
}

/**
 * Bayes-gewichteter Wert: wenige Stimmen ziehen Richtung 4,3, viele Stimmen zählen voll.
 * Rezepte ohne Bewertung bekommen -1 und landen beim Sortieren hinten.
 */
export function ratingScore(r: Recipe): number {
  const s = r.source
  if (!s || s.rating === undefined) return -1
  const n = s.ratingCount ?? 1
  const prior = 4.3, weight = 20
  return (s.rating * n + prior * weight) / (n + weight)
}

export function formatRating(v: number): string {
  return v.toFixed(1).replace('.', ',')
}

export function formatCount(n: number): string {
  return n.toLocaleString('de-DE')
}
