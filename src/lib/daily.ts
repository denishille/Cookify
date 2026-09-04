import type { Recipe } from '../types'

/** Kleiner deterministischer Zufallsgenerator (mulberry32). */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function daySeed(date = new Date()): number {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 2166136261
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const SWEET_CATEGORIES = new Set(['nachspeise', 'backen'])
const SWEET_WORDS = /kuchen|torte|waffel|pfannkuchen|pancake|crepe|muffin|keks|cookie|brownie|creme|crème|tiramisu|eis\b|dessert|schoko|zimt|marmelade|pudding|milchreis|grießbrei|griessbrei|porridge|granola|müsli|muesli|kaiserschmarrn|strudel|tarte|donut|zupfkuchen|schmarrn|brioche|hefezopf|franzbrötchen|zimtschnecke|streusel|kompott|mousse|panna cotta|quarkbällchen|buchtel|dampfnudel|windbeutel|clafouti|trifle|crumble|banana bread|bananenbrot/i

/** Süß im Sinne der Vorschläge: Kategorie oder ein eindeutig süßes Wort in Titel und Tags. */
export function isSweet(r: Recipe): boolean {
  if (SWEET_CATEGORIES.has(r.category)) return true
  return SWEET_WORDS.test(`${r.title} ${r.tags.join(' ')}`)
}

/**
 * Vorschläge des Tages: vier deftige Rezepte (möglichst verschiedene Kategorien, keine Getränke)
 * und ein süßes. Gleiche Auswahl für alle an einem Tag, wechselt täglich.
 */
export function dailyPicks(pool: Recipe[], n = 5, date = new Date()): Recipe[] {
  const rand = rng(daySeed(date))
  const shuffled = [...pool].sort(() => rand() - 0.5)
  const hearty = shuffled.filter((r) => !isSweet(r) && r.category !== 'getraenk')
  const sweet = shuffled.filter((r) => isSweet(r))
  const picks: Recipe[] = []
  const usedCategories = new Set<string>()
  for (const r of hearty) {
    if (picks.length >= n - 1) break
    if (usedCategories.has(r.category)) continue
    picks.push(r); usedCategories.add(r.category)
  }
  for (const r of hearty) {
    if (picks.length >= n - 1) break
    if (!picks.includes(r)) picks.push(r)
  }
  if (sweet[0]) picks.push(sweet[0])
  // Auffüllen nur mit Herzhaftem, damit höchstens ein süßes Rezept in der Reihe steht.
  for (const r of hearty) {
    if (picks.length >= n) break
    if (!picks.includes(r)) picks.push(r)
  }
  return picks
}
