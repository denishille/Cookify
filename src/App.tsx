import { useMemo, useState } from 'react'
import { ALL_RECIPES } from './data'
import type { Recipe } from './types'
import { useRoute, navigate, openRecipe, type View } from './lib/router'
import { usePersistentSet, usePersistentState } from './lib/storage'
import { isoWeek, weekLte, formatWeek, addWeeks } from './lib/week'
import { rankByPantry } from './lib/match'
import { RecipeCard } from './components/RecipeCard'
import { RecipeDetail } from './components/RecipeDetail'
import { PantryPicker } from './components/PantryPicker'
import { Filters } from './components/Filters'
import { applyFilters, EMPTY_FILTERS, type FilterState } from './lib/filters'

const CURRENT_WEEK = isoWeek()

/** Alle Rezepte, die bis einschließlich dieser Woche freigeschaltet sind. */
const AVAILABLE: Recipe[] = ALL_RECIPES.filter((r) => weekLte(r.addedWeek, CURRENT_WEEK))
const UPCOMING: Recipe[] = ALL_RECIPES.filter((r) => !weekLte(r.addedWeek, CURRENT_WEEK))
const NEW_THIS_WEEK = AVAILABLE.filter((r) => r.addedWeek === CURRENT_WEEK)
const BY_ID = new Map(AVAILABLE.map((r) => [r.id, r]))

const NAV: { view: View; label: string; icon: string }[] = [
  { view: 'konfigurator', label: 'Konfigurator', icon: '🧑‍🍳' },
  { view: 'entdecken', label: 'Entdecken', icon: '🔍' },
  { view: 'neu', label: 'Neu', icon: '✨' },
  { view: 'gespeichert', label: 'Gespeichert', icon: '❤️' },
]

type Sort = 'relevanz' | 'neu' | 'schnell' | 'kcal' | 'protein'

function sortRecipes(list: Recipe[], sort: Sort): Recipe[] {
  const copy = [...list]
  switch (sort) {
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
    .slice(0, 5)
    .map((x) => x.r)
}

export default function App() {
  const route = useRoute()
  const savedSet = usePersistentSet('kitchenaid.saved')
  const pantrySet = usePersistentSet('kitchenaid.pantry')
  const [seenWeek, setSeenWeek] = usePersistentState<string>('kitchenaid.seenWeek', '')
  const [maxMissing, setMaxMissing] = usePersistentState<number>('kitchenaid.maxMissing', 3)
  const [pantryFilters, setPantryFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('relevanz')

  const newBadge = NEW_THIS_WEEK.length > 0 && seenWeek !== CURRENT_WEEK ? NEW_THIS_WEEK.length : 0

  const go = (view: View) => {
    if (view === 'neu') setSeenWeek(CURRENT_WEEK)
    navigate(view)
  }

  const pantryResults = useMemo(
    () => rankByPantry(applyFilters(AVAILABLE, pantryFilters), pantrySet.set, maxMissing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pantrySet.set.size, [...pantrySet.set].join(','), maxMissing, pantryFilters],
  )

  const discoverResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = applyFilters(AVAILABLE, filters).filter((r) =>
      !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.includes(q)) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
    )
    return sortRecipes(base, sort)
  }, [query, filters, sort])

  const savedRecipes = [...savedSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))

  const detail = route.recipeId ? BY_ID.get(route.recipeId) : null

  const surprise = () => {
    const pool = discoverResults.length ? discoverResults : AVAILABLE
    openRecipe(pool[Math.floor(Math.random() * pool.length)].id)
  }

  const cardProps = (r: Recipe) => ({
    recipe: r,
    saved: savedSet.has(r.id),
    onToggleSave: savedSet.toggle,
    isNew: r.addedWeek === CURRENT_WEEK,
  })

  const nextWeekCount = UPCOMING.filter((r) => r.addedWeek === addWeeks(CURRENT_WEEK, 1)).length

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <a className="brand" href="#/konfigurator">
            <span className="brand-mark">🍳</span>
            <span>KitchenAid<small>{AVAILABLE.length} Rezepte · {formatWeek(CURRENT_WEEK)}</small></span>
          </a>
          <nav className="nav">
            {NAV.map((n) => (
              <button key={n.view} className={route.view === n.view && !detail ? 'active' : ''} onClick={() => go(n.view)}>
                <span className="ico">{n.icon}</span>
                <span>{n.label}</span>
                {n.view === 'neu' && newBadge > 0 && <span className="badge">{newBadge}</span>}
                {n.view === 'gespeichert' && savedSet.set.size > 0 && <span className="badge" style={{ background: 'var(--text-muted)' }}>{savedSet.set.size}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {route.recipeId && !detail && (
          <div className="empty">
            <div className="big">🤷</div>
            Dieses Rezept gibt es (noch) nicht.
            <div style={{ marginTop: 12 }}><button className="btn" onClick={() => navigate('entdecken')}>Zu allen Rezepten</button></div>
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
          />
        )}

        {!route.recipeId && route.view === 'konfigurator' && (
          <>
            <h1 className="page-title">Rezept-Konfigurator</h1>
            <p className="page-sub">Wähle aus, was du zuhause hast, und wir finden das passende Gericht.</p>
            <div className="two-col">
              <div className="sticky">
                <PantryPicker pantry={pantrySet.set} onToggle={pantrySet.toggle} onClear={pantrySet.clear} onReplace={pantrySet.replace} />
              </div>
              <div>
                <div className="panel" style={{ marginBottom: 14 }}>
                  <div className="filter-row">
                    <span className="filter-label">Fehlende Zutaten erlaubt</span>
                    <div className="chips">
                      {[0, 1, 2, 3, 5, 99].map((n) => (
                        <button key={n} className={`chip ${maxMissing === n ? 'on' : ''}`} onClick={() => setMaxMissing(n)}>
                          {n === 0 ? 'Keine – alles da' : n === 99 ? 'Egal, nach Treffern sortieren' : `bis zu ${n}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Filters value={pantryFilters} onChange={setPantryFilters} compact />
                </div>

                {pantrySet.set.size === 0 ? (
                  <div className="empty">
                    <div className="big">🧺</div>
                    Füge links Zutaten hinzu, um Vorschläge zu bekommen.
                  </div>
                ) : pantryResults.length === 0 ? (
                  <div className="empty">
                    <div className="big">🍽️</div>
                    Mit diesem Vorrat passt gerade nichts. Erlaube mehr fehlende Zutaten oder füge etwas hinzu.
                  </div>
                ) : (
                  <>
                    <div className="section-title" style={{ marginTop: 0 }}>
                      Das kannst du kochen <span className="count">{pantryResults.length} Treffer</span>
                    </div>
                    {pantryResults.length < 5 && maxMissing < 99 && (
                      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>Wenige Treffer? Erlaube mehr fehlende Zutaten oder lade das Set „Grundvorrat“.</p>
                    )}
                    <div className="grid">
                      {pantryResults.slice(0, 60).map((m) => (
                        <RecipeCard key={m.recipe.id} {...cardProps(m.recipe)} match={m} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {!route.recipeId && route.view === 'entdecken' && (
          <>
            <h1 className="page-title">Rezepte entdecken</h1>
            <p className="page-sub">{AVAILABLE.length} Rezepte – von schnell bis festlich, von vegan bis Steak.</p>
            <div className="toolbar">
              <input className="input grow" placeholder="Suche nach Gericht, Zutat oder Tag …" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="relevanz">Sortierung: Standard</option>
                <option value="neu">Neueste zuerst</option>
                <option value="schnell">Schnellste zuerst</option>
                <option value="kcal">Wenigste Kalorien</option>
                <option value="protein">Meistes Protein</option>
              </select>
              <button className="btn" onClick={surprise}>🎲 Überrasch mich</button>
            </div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <Filters value={filters} onChange={setFilters} />
            </div>
            {discoverResults.length === 0 ? (
              <div className="empty"><div className="big">🔍</div>Nichts gefunden. Probier andere Filter.</div>
            ) : (
              <div className="grid">
                {discoverResults.map((r) => <RecipeCard key={r.id} {...cardProps(r)} />)}
              </div>
            )}
          </>
        )}

        {!route.recipeId && route.view === 'neu' && (
          <>
            <div className="week-banner">
              <h2>✨ Neu in {formatWeek(CURRENT_WEEK)}</h2>
              <p>
                {NEW_THIS_WEEK.length > 0
                  ? `${NEW_THIS_WEEK.length} neue Rezepte sind diese Woche dazugekommen.`
                  : 'Diese Woche gab es keinen Nachschub – nächste Woche geht es weiter.'}
                {nextWeekCount > 0 && ` Nächste Woche kommen ${nextWeekCount} weitere.`}
              </p>
            </div>
            {NEW_THIS_WEEK.length > 0 && (
              <div className="grid">
                {NEW_THIS_WEEK.map((r) => <RecipeCard key={r.id} {...cardProps(r)} />)}
              </div>
            )}
            {(() => {
              const older = [...new Set(AVAILABLE.map((r) => r.addedWeek))]
                .filter((w) => w !== CURRENT_WEEK)
                .sort()
                .reverse()
                .slice(0, 4)
              return older.map((w) => {
                const list = AVAILABLE.filter((r) => r.addedWeek === w)
                return (
                  <div key={w}>
                    <div className="section-title">{formatWeek(w)} <span className="count">{list.length} Rezepte</span></div>
                    <div className="grid">{list.map((r) => <RecipeCard key={r.id} {...cardProps(r)} />)}</div>
                  </div>
                )
              })
            })()}
          </>
        )}

        {!route.recipeId && route.view === 'gespeichert' && (
          <>
            <h1 className="page-title">Gespeicherte Rezepte</h1>
            <p className="page-sub">Deine Favoriten, direkt auf diesem Gerät gespeichert.</p>
            {savedRecipes.length === 0 ? (
              <div className="empty">
                <div className="big">🤍</div>
                Noch nichts gespeichert. Tippe auf das Herz bei einem Rezept.
                <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => navigate('entdecken')}>Rezepte entdecken</button></div>
              </div>
            ) : (
              <div className="grid">
                {savedRecipes.map((r) => <RecipeCard key={r.id} {...cardProps(r)} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
