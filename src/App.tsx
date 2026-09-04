import { useMemo, useState } from 'react'
import { ALL_RECIPES } from './data'
import type { Recipe } from './types'
import { useRoute, navigate, openRecipe, type View } from './lib/router'
import { usePersistentSet, usePersistentState } from './lib/storage'
import { isoWeek, weekLte } from './lib/week'
import { rankByPantry } from './lib/match'
import { applyFilters, isEmpty, EMPTY_FILTERS, type FilterState } from './lib/filters'
import { ratingScore } from './lib/rating'
import { dailyPicks } from './lib/daily'
import { DEFAULT_SETS, slugId, type PantrySet } from './lib/sets'
import { RecipeCard } from './components/RecipeCard'
import { RecipeRow } from './components/RecipeRow'
import { RecipeDetail } from './components/RecipeDetail'
import { PantryPicker } from './components/PantryPicker'
import { SetsDrawer } from './components/SetsDrawer'
import { FilterGroups } from './components/Filters'
import { IconBasket, IconBook, IconDice, IconHeart, IconSearch } from './components/Icons'
import { LogoMark, Wordmark } from './components/Logo'

const CURRENT_WEEK = isoWeek()
const AVAILABLE: Recipe[] = ALL_RECIPES.filter((r) => weekLte(r.addedWeek, CURRENT_WEEK))
const BY_ID = new Map(AVAILABLE.map((r) => [r.id, r]))
const HAS_RATINGS = AVAILABLE.some((r) => r.source?.rating !== undefined)
const DAILY = dailyPicks(AVAILABLE, 5)

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'rezepte', label: 'Rezepte', icon: <IconBook /> },
  { view: 'vorrat', label: 'Was hab ich da?', icon: <IconBasket /> },
  { view: 'gespeichert', label: 'Gespeichert', icon: <IconHeart /> },
]

type Sort = 'standard' | 'bewertung' | 'neu' | 'schnell' | 'kcal' | 'protein'
const MISSING_CHOICES = [0, 1, 2, 3, 4, 5, 6, 8, 10]

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
  const maxMissing = storedMissing === 99 || MISSING_CHOICES.includes(storedMissing) ? storedMissing : 3
  /** Zuletzt gewählte Zahl für „Bis zu N fehlen“, bleibt erhalten, wenn man auf „Alle Treffer“ wechselt. */
  const [missingN, setMissingN] = usePersistentState<number>('cookify.missingN', 3)
  const missingMode: 'upto' | 'all' = maxMissing === 99 ? 'all' : 'upto'
  const [pantryFilters, setPantryFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sets, setSets] = usePersistentState<PantrySet[]>('cookify.sets', DEFAULT_SETS)
  const [setsOpen, setSetsOpen] = useState(false)
  const applySet = (st: PantrySet) => pantrySet.replace([...pantrySet.set, ...st.keys])
  const saveSet = (name: string) => {
    const id = slugId(name)
    const next: PantrySet = { id, name, keys: [...pantrySet.set] }
    setSets((prev) => [...prev.filter((x) => x.id !== id), next])
  }
  const deleteSet = (id: string) => setSets((prev) => prev.filter((x) => x.id !== id))
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>('standard')

  const pantryKey = [...pantrySet.set].sort().join(',')
  const pantryResults = useMemo(
    () => rankByPantry(applyFilters(AVAILABLE, pantryFilters), new Set(pantryKey ? pantryKey.split(',') : []), maxMissing),
    [pantryKey, maxMissing, pantryFilters],
  )

  /** Treffer gibt es nur, wenn im Konfigurator etwas gesetzt ist. */
  const configured = !isEmpty(filters)
  const results = useMemo(() => sortRecipes(applyFilters(AVAILABLE, filters), sort), [filters, sort])

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
            <FilterGroups value={filters} onChange={setFilters} hasRatings={HAS_RATINGS} />

            {!configured && (
              <div className="section">
                <div className="section-head"><h2>Vorschläge des Tages</h2></div>
                <div className="strip">
                  {DAILY.map((r) => <RecipeCard key={r.id} {...card(r)} />)}
                </div>
              </div>
            )}

            {configured && (
              <div className="section results">
                <div className="section-head">
                  <h2>{results.length} {results.length === 1 ? 'Rezept' : 'Rezepte'}</h2>
                  <div className="results-tools">
                    <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
                      <option value="standard">Sortieren</option>
                      {HAS_RATINGS && <option value="bewertung">Beste Bewertung</option>}
                      <option value="neu">Neueste zuerst</option>
                      <option value="schnell">Schnellste zuerst</option>
                      <option value="kcal">Wenigste Kalorien</option>
                      <option value="protein">Meistes Protein</option>
                    </select>
                    <button className="btn sm" onClick={surprise} title="Zufälliges Rezept aus den Treffern"><IconDice width={16} height={16} /> Überrasch mich</button>
                  </div>
                </div>
                {results.length === 0 ? (
                  <div className="empty">
                    <div className="ico"><IconSearch /></div>
                    <h3>Nichts gefunden</h3>
                    <p>Nimm einen Filter raus, dann wird die Auswahl größer.</p>
                    <button className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>Zurücksetzen</button>
                  </div>
                ) : (
                  <div className="list">{results.map((r) => <RecipeRow key={r.id} recipe={r} saved={savedSet.has(r.id)} onToggleSave={savedSet.toggle} />)}</div>
                )}
              </div>
            )}
          </>
        )}

        {!route.recipeId && route.view === 'vorrat' && (
          <>
            <SetsDrawer open={setsOpen} onOpen={() => setSetsOpen(true)} onClose={() => setSetsOpen(false)} pantry={pantrySet.set}
              sets={sets} onApplySet={applySet} onSaveSet={saveSet} onDeleteSet={deleteSet} />
            <h1 className="h1">Was hab ich da?</h1>
            <div className="split">
              <div className="sticky">
                <PantryPicker pantry={pantrySet.set} onToggle={pantrySet.toggle} onClear={pantrySet.clear} />
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
                        <span className={`seg ${missingMode === 'upto' ? 'on' : ''}`}>
                          <button onClick={() => setMaxMissing(missingN)}>Bis zu</button>
                          <select className="mini" value={missingMode === 'upto' ? maxMissing : missingN} aria-label="Anzahl fehlender Zutaten"
                            onFocus={() => { if (missingMode !== 'upto') setMaxMissing(missingN) }}
                            onClick={() => { if (missingMode !== 'upto') setMaxMissing(missingN) }}
                            onChange={(e) => { const n = Number(e.target.value); setMissingN(n); setMaxMissing(n) }}>
                            {MISSING_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button onClick={() => setMaxMissing(missingN)}>fehlen</button>
                        </span>
                        <button className={missingMode === 'all' ? 'on' : ''} onClick={() => setMaxMissing(99)}>Alle Treffer</button>
                      </div>
                      <span className="hint">{pantryResults.length} Treffer</span>
                    </div>
                    <FilterGroups value={pantryFilters} onChange={setPantryFilters} hasRatings={HAS_RATINGS} hideCategory />
                    <div style={{ height: 18 }} />
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
