import { useMemo, useState } from 'react'
import { ALL_RECIPES } from './data'
import type { Recipe } from './types'
import { useRoute, navigate, openRecipe, type View } from './lib/router'
import { usePersistentSet, usePersistentState } from './lib/storage'
import { isoWeek, weekLte, formatWeek, addWeeks } from './lib/week'
import { rankByPantry } from './lib/match'
import { applyFilters, activeCount, isEmpty, EMPTY_FILTERS, type FilterState } from './lib/filters'
import { ratingScore } from './lib/rating'
import { RecipeCard } from './components/RecipeCard'
import { RecipeDetail } from './components/RecipeDetail'
import { PantryPicker } from './components/PantryPicker'
import { QuickFilters, FilterPanel } from './components/Filters'
import { IconBasket, IconBook, IconDice, IconFilter, IconHeart, IconSearch, IconSparkle, IconX } from './components/Icons'
import { LogoMark, Wordmark } from './components/Logo'

const CURRENT_WEEK = isoWeek()
const AVAILABLE: Recipe[] = ALL_RECIPES.filter((r) => weekLte(r.addedWeek, CURRENT_WEEK))
const UPCOMING: Recipe[] = ALL_RECIPES.filter((r) => !weekLte(r.addedWeek, CURRENT_WEEK))
const NEW_THIS_WEEK = AVAILABLE.filter((r) => r.addedWeek === CURRENT_WEEK)
const NEXT_WEEK_COUNT = UPCOMING.filter((r) => r.addedWeek === addWeeks(CURRENT_WEEK, 1)).length
const BY_ID = new Map(AVAILABLE.map((r) => [r.id, r]))
const HAS_RATINGS = AVAILABLE.some((r) => r.source?.rating !== undefined)

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'rezepte', label: 'Rezepte', icon: <IconBook /> },
  { view: 'vorrat', label: 'Was hab ich da?', icon: <IconBasket /> },
  { view: 'gespeichert', label: 'Gespeichert', icon: <IconHeart /> },
]

type Sort = 'standard' | 'bewertung' | 'neu' | 'schnell' | 'kcal' | 'protein'
const MISSING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Alles da' },
  { value: 3, label: 'Bis zu 3 fehlen' },
  { value: 99, label: 'Alle Treffer' },
]

function sortRecipes(list: Recipe[], sort: Sort): Recipe[] {
  const copy = [...list]
  switch (sort) {
    case 'bewertung': return copy.sort((a, b) => ratingScore(b) - ratingScore(a))
    case 'neu': return copy.sort((a, b) => (a.addedWeek < b.addedWeek ? 1 : a.addedWeek > b.addedWeek ? -1 : a.title.localeCompare(b.title, 'de')))
    case 'schnell': return copy.sort((a, b) => a.timeMinutes - b.timeMinutes)
    case 'kcal': return copy.sort((a, b) => a.nutrition.kcal - b.nutrition.kcal)
    case 'protein': return copy.sort((a, b) => b.nutrition.protein - a.nutrition.protein)
    default: return copy
  }
}

function related(recipe: Recipe): Recipe[] {
  const keys = new Set(recipe.ingredients.map((i) => i.key))
  return AVAILABLE
    .filter((r) => r.id !== recipe.id)
    .map((r) => ({ r, s: (r.category === recipe.category ? 2 : 0) + (r.cuisine === recipe.cuisine ? 1 : 0) + r.ingredients.filter((i) => keys.has(i.key)).length * 0.5 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.r)
}

export default function App() {
  const route = useRoute()
  const savedSet = usePersistentSet('cookify.saved')
  const pantrySet = usePersistentSet('cookify.pantry')
  const [storedMissing, setMaxMissing] = usePersistentState<number>('cookify.maxMissing', 3)
  const maxMissing = MISSING_OPTIONS.some((o) => o.value === storedMissing) ? storedMissing : 3
  const [pantryFilters, setPantryFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('standard')

  const pantryKey = [...pantrySet.set].sort().join(',')
  const pantryResults = useMemo(
    () => rankByPantry(applyFilters(AVAILABLE, pantryFilters), new Set(pantryKey ? pantryKey.split(',') : []), maxMissing),
    [pantryKey, maxMissing, pantryFilters],
  )

  const q = query.trim().toLowerCase()
  const browsing = !q && isEmpty(filters)
  const results = useMemo(() => {
    const base = applyFilters(AVAILABLE, filters).filter((r) =>
      !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.includes(q)) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
    )
    return sortRecipes(base, sort)
  }, [q, filters, sort])

  const savedRecipes = [...savedSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))
  const detail = route.recipeId ? BY_ID.get(route.recipeId) : null

  const surprise = () => {
    const pool = results.length ? results : AVAILABLE
    openRecipe(pool[Math.floor(Math.random() * pool.length)].id)
  }

  const card = (r: Recipe) => ({ recipe: r, saved: savedSet.has(r.id), onToggleSave: savedSet.toggle, isNew: r.addedWeek === CURRENT_WEEK })

  const tabs = (className: string) => (
    <nav className={className} aria-label="Hauptnavigation">
      {NAV.map((n) => (
        <button key={n.view} className={`tab ${route.view === n.view && !detail ? 'active' : ''}`} onClick={() => navigate(n.view)} aria-current={route.view === n.view && !detail ? 'page' : undefined}>
          {n.icon}
          <span>{n.label}</span>
          {n.view === 'gespeichert' && savedSet.set.size > 0 && <span className="count">{savedSet.set.size}</span>}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/rezepte" aria-label="Cookify – Startseite"><LogoMark /><Wordmark /></a>
          {tabs('nav')}
        </div>
      </header>
      {tabs('tabbar')}

      <main className="main">
        {route.recipeId && !detail && (
          <div className="empty">
            <div className="ico"><IconSearch /></div>
            <h3>Dieses Rezept gibt es (noch) nicht.</h3>
            <button className="btn primary" onClick={() => navigate('rezepte')}>Zu allen Rezepten</button>
          </div>
        )}

        {detail && (
          <RecipeDetail
            key={detail.id}
            recipe={detail}
            saved={savedSet.has(detail.id)}
            onToggleSave={savedSet.toggle}
            pantry={pantrySet.set}
            onTogglePantry={pantrySet.toggle}
            related={related(detail)}
            isNew={detail.addedWeek === CURRENT_WEEK}
            savedIds={savedSet.set}
          />
        )}

        {!route.recipeId && route.view === 'rezepte' && (
          <>
            <h1 className="h1">Was kochen wir heute?</h1>
            <p className="lead">{AVAILABLE.length} Rezepte, jede Woche kommen neue dazu.</p>

            <div className="controls">
              <div className="searchbox">
                <IconSearch />
                <input placeholder="Gericht oder Zutat suchen …" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rezepte durchsuchen" />
                {query && <button className="clear" onClick={() => setQuery('')} aria-label="Suche löschen"><IconX width={16} height={16} /></button>}
              </div>
              <button className={`btn ${panelOpen || activeCount(filters) ? 'on' : ''}`} onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
                <IconFilter width={18} height={18} /> Filter {activeCount(filters) > 0 && <span className="n">{activeCount(filters)}</span>}
              </button>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
                <option value="standard">Sortieren</option>
                {HAS_RATINGS && <option value="bewertung">Beste Bewertung</option>}
                <option value="neu">Neueste zuerst</option>
                <option value="schnell">Schnellste zuerst</option>
                <option value="kcal">Wenigste Kalorien</option>
                <option value="protein">Meistes Protein</option>
              </select>
              <button className="btn icon" onClick={surprise} aria-label="Zufälliges Rezept" title="Überrasch mich"><IconDice /></button>
            </div>
            <div style={{ marginTop: 14 }}><QuickFilters value={filters} onChange={setFilters} hasRatings={HAS_RATINGS} /></div>
            {panelOpen && <FilterPanel value={filters} onChange={setFilters} onClose={() => setPanelOpen(false)} hasRatings={HAS_RATINGS} />}

            {browsing && NEW_THIS_WEEK.length > 0 && (
              <div className="section">
                <div className="section-head">
                  <h2><IconSparkle width={20} height={20} style={{ color: 'var(--green)', verticalAlign: -3, marginRight: 6 }} />Neu diese Woche</h2>
                  <span className="sub">{formatWeek(CURRENT_WEEK)}{NEXT_WEEK_COUNT > 0 && ` · nächste Woche ${NEXT_WEEK_COUNT} weitere`}</span>
                </div>
                <div className="grid">{NEW_THIS_WEEK.map((r) => <RecipeCard key={r.id} {...card(r)} />)}</div>
              </div>
            )}

            <div className="section">
              <div className="section-head">
                <h2>{browsing ? 'Alle Rezepte' : 'Ergebnisse'}</h2>
                <span className="sub">{results.length} {results.length === 1 ? 'Rezept' : 'Rezepte'}</span>
              </div>
              {results.length === 0 ? (
                <div className="empty">
                  <div className="ico"><IconSearch /></div>
                  <h3>Nichts gefunden</h3>
                  <p>Probier einen anderen Begriff oder setz die Filter zurück.</p>
                  <button className="btn" onClick={() => { setQuery(''); setFilters(EMPTY_FILTERS) }}>Zurücksetzen</button>
                </div>
              ) : (
                <div className="grid">{results.map((r) => <RecipeCard key={r.id} {...card(r)} />)}</div>
              )}
            </div>
          </>
        )}

        {!route.recipeId && route.view === 'vorrat' && (
          <>
            <h1 className="h1">Was hab ich da?</h1>
            <p className="lead">Sag uns, was im Kühlschrank ist. Wir zeigen dir, was du daraus kochen kannst.</p>
            <div className="split">
              <div className="sticky">
                <PantryPicker pantry={pantrySet.set} onToggle={pantrySet.toggle} onClear={pantrySet.clear} onReplace={pantrySet.replace} />
              </div>
              <div>
                {pantrySet.set.size === 0 ? (
                  <div className="empty">
                    <div className="ico"><IconBasket /></div>
                    <h3>Dein Vorrat ist noch leer</h3>
                    <p>Füge ein paar Zutaten hinzu, dann geht es los.</p>
                  </div>
                ) : (
                  <>
                    <div className="results-head">
                      <div className="segmented" role="group" aria-label="Fehlende Zutaten">
                        {MISSING_OPTIONS.map((o) => (
                          <button key={o.value} className={maxMissing === o.value ? 'on' : ''} onClick={() => setMaxMissing(o.value)}>{o.label}</button>
                        ))}
                      </div>
                      <span className="hint">{pantryResults.length} {pantryResults.length === 1 ? 'Treffer' : 'Treffer'}</span>
                    </div>
                    <div style={{ marginBottom: 18 }}><QuickFilters value={pantryFilters} onChange={setPantryFilters} hasRatings={HAS_RATINGS} /></div>
                    {pantryResults.length === 0 ? (
                      <div className="empty">
                        <div className="ico"><IconBasket /></div>
                        <h3>Noch kein passendes Rezept</h3>
                        <p>Erlaube fehlende Zutaten oder füge etwas hinzu.</p>
                        {maxMissing !== 99 && <button className="btn" onClick={() => setMaxMissing(99)}>Alle Treffer zeigen</button>}
                      </div>
                    ) : (
                      <div className="grid">
                        {pantryResults.slice(0, 60).map((m) => <RecipeCard key={m.recipe.id} {...card(m.recipe)} match={m} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {!route.recipeId && route.view === 'gespeichert' && (
          <>
            <h1 className="h1">Gespeichert</h1>
            <p className="lead">Deine Favoriten, auf diesem Gerät gespeichert.</p>
            {savedRecipes.length === 0 ? (
              <div className="empty" style={{ marginTop: 22 }}>
                <div className="ico"><IconHeart /></div>
                <h3>Noch nichts gespeichert</h3>
                <p>Tipp auf das Herz bei einem Rezept, dann findest du es hier wieder.</p>
                <button className="btn primary" onClick={() => navigate('rezepte')}>Rezepte ansehen</button>
              </div>
            ) : (
              <div className="grid" style={{ marginTop: 22 }}>{savedRecipes.map((r) => <RecipeCard key={r.id} {...card(r)} />)}</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
