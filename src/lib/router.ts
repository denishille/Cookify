import { useEffect, useState } from 'react'

export type View = 'konfigurator' | 'entdecken' | 'neu' | 'gespeichert'

export interface Route {
  view: View
  recipeId: string | null
}

const VIEWS: View[] = ['konfigurator', 'entdecken', 'neu', 'gespeichert']

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'rezept' && parts[1]) return { view: 'entdecken', recipeId: decodeURIComponent(parts[1]) }
  const view = VIEWS.includes(parts[0] as View) ? (parts[0] as View) : 'konfigurator'
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
  else navigate('entdecken')
}
