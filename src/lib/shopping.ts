import { useCallback } from 'react'
import type { Ingredient, Recipe } from '../types'
import { usePersistentState } from './storage'
import { STAPLE_KEYS } from '../data'

export interface ShoppingItem {
  id: string
  key: string
  name: string
  amount: number | null
  unit: string
  /** Titel des Rezepts, aus dem die Zutat stammt */
  from?: string
  done: boolean
}

const newId = () => Math.random().toString(36).slice(2, 10)

/** Einkaufsliste im Browser: Zutaten einzeln oder ganze Rezepte, beim Einkauf abhaken. */
export function useShoppingList() {
  const [items, setItems] = usePersistentState<ShoppingItem[]>('cookify.shopping', [])

  /** Gleiche Zutat mit gleicher Einheit wird zusammengezählt statt doppelt gelistet. */
  const merge = (list: ShoppingItem[], add: Omit<ShoppingItem, 'id' | 'done'>): ShoppingItem[] => {
    const i = list.findIndex((x) => !x.done && x.key === add.key && x.unit === add.unit && x.amount !== null && add.amount !== null)
    if (i >= 0) {
      const next = [...list]
      next[i] = { ...next[i], amount: (next[i].amount ?? 0) + (add.amount ?? 0), from: next[i].from === add.from ? next[i].from : undefined }
      return next
    }
    return [...list, { ...add, id: newId(), done: false }]
  }

  const addIngredient = useCallback((ing: Ingredient, from?: string) =>
    setItems((prev) => merge(prev, { key: ing.key, name: ing.name, amount: ing.amount, unit: ing.unit, from })), [setItems])

  /** Alle Pflichtzutaten eines Rezepts, die nicht im Vorrat und kein Grundvorrat sind. Liefert die Anzahl. */
  const addRecipe = useCallback((recipe: Recipe, pantry: Set<string>, factor = 1): number => {
    const needed = recipe.ingredients.filter((i) => !i.optional && !STAPLE_KEYS.has(i.key) && !pantry.has(i.key))
    setItems((prev) => needed.reduce((acc, i) => merge(acc, { key: i.key, name: i.name, amount: i.amount === null ? null : Math.round(i.amount * factor * 10) / 10, unit: i.unit, from: recipe.title }), prev))
    return needed.length
  }, [setItems])

  const toggleDone = useCallback((id: string) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x))), [setItems])
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((x) => x.id !== id)), [setItems])
  const clearDone = useCallback(() => setItems((prev) => prev.filter((x) => !x.done)), [setItems])
  const clearAll = useCallback(() => setItems([]), [setItems])
  const replace = useCallback((list: ShoppingItem[]) => setItems(list), [setItems])

  return { items, addIngredient, addRecipe, toggleDone, remove, clearDone, clearAll, replace, openCount: items.filter((x) => !x.done).length }
}
