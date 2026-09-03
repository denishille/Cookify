import { useEffect, useState } from 'react'

export type View = 'rezepte' | 'vorrat' | 'gespeichert'

export interface Route {
  view: View
  recipeId: string | null
}

const VIEWS: View[] = ['rezepte', 'vorrat', 'gespeichert']
const LEGACY: Record<string, View> = { entdecken: 'rezepte', neu: 'rezepte', konfigurator: 'vorrat' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'rezept' && parts[1]) return { view: 'rezepte', recipeId: decodeURIComponent(parts[1]) }
  const raw = parts[0] ?? ''
  const view = VIEWS.includes(raw as View) ? (raw as View) : LEGACY[raw] ?? 'rezepte'
  return { view, recipeId: null }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(view: View) {
  window.location.hash = `#/${view}`
}

export function openRecipe(id: string) {
  window.location.hash = `#/rezept/${encodeURIComponent(id)}`
}

export function back() {
  if (window.history.length > 1) window.history.back()
  else navigate('rezepte')
}
