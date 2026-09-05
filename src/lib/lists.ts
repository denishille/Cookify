import { useCallback } from 'react'
import { usePersistentState } from './storage'
import { slugId } from './sets'

/** Eine eigene Rezeptliste, z. B. „Wochenplan“ oder „Für Gäste“. */
export interface RecipeList {
  id: string
  name: string
  recipeIds: string[]
}

/** Base64 ohne Sonderzeichen, damit die Liste in eine Adresse passt. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Packt eine Liste in ein Kürzel für den Link. */
export function encodeList(list: Pick<RecipeList, 'name' | 'recipeIds'>): string {
  return toBase64Url(JSON.stringify({ n: list.name, r: list.recipeIds }))
}

/** Liest das Kürzel aus einem geteilten Link wieder aus. */
export function decodeList(code: string): { name: string; recipeIds: string[] } | null {
  try {
    const data = JSON.parse(fromBase64Url(code)) as { n?: unknown; r?: unknown }
    const name = typeof data.n === 'string' ? data.n.slice(0, 60) : ''
    const recipeIds = Array.isArray(data.r) ? data.r.filter((x): x is string => typeof x === 'string') : []
    if (!name || recipeIds.length === 0) return null
    return { name, recipeIds }
  } catch {
    return null
  }
}

/** Adresse zum Teilen einer Liste. */
export function listUrl(list: Pick<RecipeList, 'name' | 'recipeIds'>): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/liste/${encodeList(list)}`
}

/** Eigene Listen, im Browser gespeichert. */
export function useLists() {
  const [lists, setLists] = usePersistentState<RecipeList[]>('cookify.lists', [])

  /** Legt eine Liste an und gibt ihre Kennung zurück – gleiche Namen bekommen eine Nummer. */
  const create = useCallback((name: string, recipeIds: string[] = []) => {
    const clean = name.trim().slice(0, 60)
    if (!clean) return null
    const base = slugId(clean)
    let id = base
    for (let n = 2; lists.some((l) => l.id === id); n++) id = `${base}-${n}`
    setLists((prev) => (prev.some((l) => l.id === id) ? prev : [...prev, { id, name: clean, recipeIds: [...new Set(recipeIds)] }]))
    return id
  }, [lists, setLists])

  const rename = useCallback((id: string, name: string) => {
    const clean = name.trim().slice(0, 60)
    if (!clean) return
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: clean } : l)))
  }, [setLists])

  const remove = useCallback((id: string) => setLists((prev) => prev.filter((l) => l.id !== id)), [setLists])

  const toggleRecipe = useCallback((listId: string, recipeId: string) => {
    setLists((prev) => prev.map((l) => (l.id === listId
      ? { ...l, recipeIds: l.recipeIds.includes(recipeId) ? l.recipeIds.filter((r) => r !== recipeId) : [...l.recipeIds, recipeId] }
      : l)))
  }, [setLists])

  /** In welchen Listen steckt ein Rezept? */
  const listsWith = useCallback((recipeId: string) => lists.filter((l) => l.recipeIds.includes(recipeId)), [lists])

  return { lists, create, rename, remove, toggleRecipe, listsWith }
}
