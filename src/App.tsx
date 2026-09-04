import { useEffect, useRef, useState } from 'react'
import { ALL_RECIPES, INGREDIENT_BY_KEY } from './data'
import type { Diet, Recipe } from './types'
import { useRoute, navigate, openRecipe, type View } from './lib/router'
import { usePersistentSet, usePersistentState } from './lib/storage'
import { isoWeek } from './lib/week'
import { rankByPantry } from './lib/match'
import { applyFilters, isEmpty, EMPTY_FILTERS, type FilterState } from './lib/filters'
import { ratingScore } from './lib/rating'
import { dailyPicks } from './lib/daily'
import { adaptRecipe } from './lib/adapt'
import { DEFAULT_SETS, type PantrySet } from './lib/sets'
import { RecipeCard } from './components/RecipeCard'
import { RecipeRow } from './components/RecipeRow'
import { RecipeDetail } from './components/RecipeDetail'
import { PantryPicker } from './components/PantryPicker'
import { SetsDrawer } from './components/SetsDrawer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ShoppingDrawer } from './components/ShoppingDrawer'
import { useShoppingList } from './lib/shopping'
import { FilterGroups } from './components/Filters'
import { IconBasket, IconBook, IconCart, IconChevronDown, IconChevronLeft, IconDice, IconHeart, IconSearch, IconSettings } from './components/Icons'
import { LogoMark, Wordmark } from './components/Logo'

const CURRENT_WEEK = isoWeek()
const BY_ID = new Map(ALL_RECIPES.map((r) => [r.id, r]))
const HAS_RATINGS = ALL_RECIPES.some((r) => r.source?.rating !== undefined)

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'rezepte', label: 'Rezepte', icon: <IconBook /> },
  { view: 'vorrat', label: 'Was hab ich da?', icon: <IconBasket /> },
  { view: 'gespeichert', label: 'Gespeichert', icon: <IconHeart /> },
]

type Sort = 'standard' | 'bewertung' | 'neu' | 'schnell' | 'langsam' | 'kcal' | 'protein'
const MISSING_CHOICES = [0, 1, 2, 3, 4, 5, 6, 8, 10]

function sortRecipes(list: Recipe[], sort: Sort): Recipe[] {
  const copy = [...list]
  switch (sort) {
    case 'bewertung': return copy.sort((a, b) => ratingScore(b) - ratingScore(a))
    case 'neu': return copy.sort((a, b) => (a.addedWeek < b.addedWeek ? 1 : a.addedWeek > b.addedWeek ? -1 : a.title.localeCompare(b.title, 'de')))
    case 'schnell': return copy.sort((a, b) => a.timeMinutes - b.timeMinutes)
    case 'langsam': return copy.sort((a, b) => b.timeMinutes - a.timeMinutes)
    case 'kcal': return copy.sort((a, b) => a.nutrition.kcal - b.nutrition.kcal)
    case 'protein': return copy.sort((a, b) => b.nutrition.protein - a.nutrition.protein)
    default: return copy
  }
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function related(recipe: Recipe, pool: Recipe[]): Recipe[] {
  const keys = new Set(recipe.ingredients.map((i) => i.key))
  return pool
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
  const missingSelect = useRef<HTMLSelectElement>(null)
  /** Klick auf „Bis zu“ oder „fehlen“: inaktiv → aktivieren, aktiv → Zahlenauswahl öffnen. */
  const onSegmentClick = () => {
    if (missingMode !== 'upto') { setMaxMissing(missingN); return }
    const el = missingSelect.current
    if (!el) return
    try { (el as HTMLSelectElement & { showPicker?: () => void }).showPicker?.() } catch { el.focus() }
  }
  const [pantryFilters, setPantryFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sets, setSets] = usePersistentState<PantrySet[]>('cookify.sets', DEFAULT_SETS)
  const [setsOpen, setSetsOpen] = useState(false)

  /** Rückgängig-Leiste: letzte Löschaktion mit Wiederherstellen, verschwindet nach 8 Sekunden. */
  const [undo, setUndo] = useState<{ message: string; restore: () => void } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 8000)
    return () => clearTimeout(t)
  }, [undo])
  const offerUndo = (message: string, restore: () => void) => setUndo({ message, restore })
  const runUndo = () => { undo?.restore(); setUndo(null) }
  const toggleHidden = (id: string) => {
    if (!hiddenSet.has(id)) offerUndo(`„${BY_ID.get(id)?.title ?? id}“ ausgeblendet`, () => hiddenSet.replace([...hiddenSet.set].filter((x) => x !== id)))
    hiddenSet.toggle(id)
  }

  const applySet = (st: PantrySet) => pantrySet.replace([...pantrySet.set, ...st.keys])
  const togglePantry = (key: string) => {
    if (pantrySet.has(key)) {
      const name = INGREDIENT_BY_KEY.get(key)?.name ?? key
      offerUndo(`${name} aus dem Vorrat entfernt`, () => pantrySet.replace([...pantrySet.set, key]))
    }
    pantrySet.toggle(key)
  }
  const clearPantry = () => {
    const before = [...pantrySet.set]
    if (before.length === 0) return
    offerUndo(`${before.length} Zutaten entfernt`, () => pantrySet.replace(before))
    pantrySet.clear()
  }
  const saveSet = (next: PantrySet) => setSets((prev) => (prev.some((x) => x.id === next.id) ? prev.map((x) => (x.id === next.id ? next : x)) : [...prev, next]))
  const deleteSet = (id: string) => {
    const idx = sets.findIndex((x) => x.id === id)
    if (idx < 0) return
    const removed = sets[idx]
    offerUndo(`Set „${removed.name}“ gelöscht`, () => setSets((prev) => (prev.some((x) => x.id === removed.id) ? prev : [...prev.slice(0, idx), removed, ...prev.slice(idx)])))
    setSets((prev) => prev.filter((x) => x.id !== id))
  }
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>('standard')

  /** Globale Ernährungsform aus den Einstellungen: filtert den gesamten Bestand, bleibt im Browser gespeichert. */
  const [globalDiets, setGlobalDiets] = usePersistentState<Diet[]>('cookify.globalDiets', [])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const shopping = useShoppingList()
  const [shopOpen, setShopOpen] = useState(false)
  const addShoppingKey = (key: string) => {
    const def = INGREDIENT_BY_KEY.get(key)
    if (def) shopping.addIngredient({ key, name: def.name, amount: null, unit: '' })
  }
  /** Ausgeblendete Rezepte (Daumen runter): tauchen nur noch am Ende von „Alle Rezepte“ auf. */
  const hiddenSet = usePersistentSet('cookify.hidden')
  // Bewusst ohne useMemo: bei rund hundert Rezepten ist das Filtern pro Render billig.
  const AVAILABLE = ALL_RECIPES.filter((r) => !hiddenSet.has(r.id) && adaptRecipe(r, globalDiets).ok)
  const hiddenRecipes = [...hiddenSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))
  const DAILY = dailyPicks(AVAILABLE, 5)

  /** Alle-Rezepte-Liste: eigene Filter und Sortierung */
  const [allFilters, setAllFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [allSort, setAllSort] = useState<Sort>('standard')
  const allBase = applyFilters(AVAILABLE, allFilters)
  const allList = allSort === 'standard' ? [...allBase].sort((a, b) => a.title.localeCompare(b.title, 'de')) : sortRecipes(allBase, allSort)

  const pantryKey = [...pantrySet.set].sort().join(',')
  const pantryResults = rankByPantry(applyFilters(AVAILABLE, pantryFilters), new Set(pantryKey ? pantryKey.split(',') : []), maxMissing)

  /** Treffer gibt es nur, wenn im Konfigurator etwas gesetzt ist. */
  const configured = !isEmpty(filters)
  const results = sortRecipes(applyFilters(AVAILABLE, filters), sort)

  const savedAll = [...savedSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))
  const savedRecipes = savedAll.filter((r) => adaptRecipe(r, globalDiets).ok)
  const savedUnfit = savedAll.length - savedRecipes.length
  const detail = route.recipeId ? BY_ID.get(route.recipeId) : null

  const surprise = () => {
    const pool = results.length ? results : AVAILABLE
    openRecipe(randomOf(pool).id)
  }

  /** Alle gerade wirksamen Ernährungsformen: Einstellungen plus die Filter der einzelnen Seiten. */
  const activeDiets: Diet[] = [...new Set<Diet>([...globalDiets, ...filters.diets, ...pantryFilters.diets, ...allFilters.diets])]
  const adaptedCount = (r: Recipe) => adaptRecipe(r, activeDiets).changes.length
  const card = (r: Recipe) => ({ recipe: r, saved: savedSet.has(r.id), onToggleSave: savedSet.toggle, isNew: r.addedWeek === CURRENT_WEEK, hidden: hiddenSet.has(r.id), onToggleHide: toggleHidden, adapted: adaptedCount(r) })

  const tabs = (className: string) => (
    <nav className={className} aria-label="Hauptnavigation">
      {NAV.map((n) => (
        <button key={n.view} className={`tab ${(route.view === n.view || (route.view === 'alle' && n.view === 'gespeichert')) && !detail ? 'active' : ''}`} onClick={() => navigate(n.view)} aria-current={route.view === n.view && !detail ? 'page' : undefined}>
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
          <button className={`settings-btn cart-btn ${shopping.openCount ? 'on' : ''}`} onClick={() => setShopOpen(true)} aria-label="Einkaufsliste" title="Einkaufsliste">
            <IconCart />
            {shopping.openCount > 0 && <span className="cart-count">{shopping.openCount}</span>}
          </button>
          <button className={`settings-btn ${globalDiets.length ? 'on' : ''}`} onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="Einstellungen">
            <IconSettings />
            {globalDiets.length > 0 && <span className="dot" />}
          </button>
        </div>
      </header>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} globalDiets={globalDiets} onChange={setGlobalDiets} />
      <ShoppingDrawer open={shopOpen} onClose={() => setShopOpen(false)} items={shopping.items} onToggleDone={shopping.toggleDone} onRemove={shopping.remove}
        onClearDone={shopping.clearDone} onClearAll={shopping.clearAll} onAddKey={addShoppingKey} diets={globalDiets} />
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
            onTogglePantry={togglePantry}
            related={related(detail, AVAILABLE)}
            isNew={detail.addedWeek === CURRENT_WEEK}
            savedIds={savedSet.set}
            activeDiets={activeDiets}
            onAddIngredientToList={(ing) => shopping.addIngredient(ing, detail.title)}
            onAddRecipeToList={(factor) => shopping.addRecipe(detail, pantrySet.set, factor)}
          />
        )}

        {!route.recipeId && route.view === 'rezepte' && (
          <>
            <h1 className="h1">Was kochen wir heute?</h1>
            <FilterGroups value={filters} onChange={setFilters} hasRatings={HAS_RATINGS} pool={AVAILABLE} globalDiets={globalDiets} />

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
                  <div className="list">{results.map((r) => <RecipeRow key={r.id} recipe={r} saved={savedSet.has(r.id)} onToggleSave={savedSet.toggle} onToggleHide={toggleHidden} adapted={adaptedCount(r)} />)}</div>
                )}
              </div>
            )}
          </>
        )}

        {!route.recipeId && route.view === 'vorrat' && (
          <>
            <SetsDrawer open={setsOpen} onOpen={() => setSetsOpen(true)} onClose={() => setSetsOpen(false)} pantry={pantrySet.set}
              sets={sets} onApplySet={applySet} onSaveSet={saveSet} onDeleteSet={deleteSet} diets={globalDiets} />
            <h1 className="h1">Was hab ich da?</h1>
            <div className="split">
              <div className="sticky">
                <PantryPicker pantry={pantrySet.set} onToggle={togglePantry} onClear={clearPantry} diets={globalDiets} />
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
                          <button onClick={onSegmentClick}>Bis zu</button>
                          <select ref={missingSelect} className="mini" value={missingMode === 'upto' ? maxMissing : missingN} aria-label="Anzahl fehlender Zutaten"
                            onFocus={() => { if (missingMode !== 'upto') setMaxMissing(missingN) }}
                            onClick={() => { if (missingMode !== 'upto') setMaxMissing(missingN) }}
                            onChange={(e) => { const n = Number(e.target.value); setMissingN(n); setMaxMissing(n) }}>
                            {MISSING_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button onClick={onSegmentClick}>fehlen</button>
                        </span>
                        <button className={missingMode === 'all' ? 'on' : ''} onClick={() => setMaxMissing(99)}>Alle Treffer</button>
                      </div>
                      <span className="hint">{pantryResults.length} Treffer</span>
                    </div>
                    <FilterGroups value={pantryFilters} onChange={setPantryFilters} hasRatings={HAS_RATINGS} hideCategory pool={AVAILABLE} globalDiets={globalDiets} />
                    <div style={{ height: 18 }} />
                    {pantryResults.length === 0 ? (
                      <div className="empty">
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

        {!route.recipeId && route.view === 'alle' && (
          <>
            <button className="backlink" onClick={() => navigate('gespeichert')}><IconChevronLeft /> Gespeichert</button>
            <div className="section-head" style={{ marginTop: 6 }}>
              <h1 className="h1">Alle Rezepte</h1>
              <span className="sub">{allList.length} {allList.length === 1 ? 'Rezept' : 'Rezepte'}</span>
            </div>
            <FilterGroups value={allFilters} onChange={setAllFilters} hasRatings={HAS_RATINGS} hideTime pool={AVAILABLE} globalDiets={globalDiets}>
              <label className="cfg-field">
                <span>Sortierung</span>
                <select className={`select ${allSort !== 'standard' ? 'on' : ''}`} value={allSort} onChange={(e) => setAllSort(e.target.value as Sort)}>
                  <option value="standard">A bis Z</option>
                  <option value="schnell">Dauer: kurz zuerst</option>
                  <option value="langsam">Dauer: lang zuerst</option>
                  <option value="kcal">Wenigste Kalorien</option>
                  <option value="protein">Meistes Protein</option>
                  {HAS_RATINGS && <option value="bewertung">Beste Bewertung</option>}
                </select>
              </label>
            </FilterGroups>
            {allList.length === 0 ? (
              <div className="empty" style={{ marginTop: 18 }}><div className="ico"><IconSearch /></div><h3>Nichts gefunden</h3><p>Nimm einen Filter raus.</p></div>
            ) : (
              <div className="list" style={{ marginTop: 18 }}>
                {allList.map((r) => <RecipeRow key={r.id} recipe={r} saved={savedSet.has(r.id)} onToggleSave={savedSet.toggle} onToggleHide={toggleHidden} adapted={adaptedCount(r)} />)}
              </div>
            )}
            {hiddenRecipes.length > 0 && (
              <details className="hidden-box">
                <summary><IconChevronDown width={18} height={18} /> Ausgeblendete Rezepte <span className="count">{hiddenRecipes.length}</span></summary>
                <p className="hint">Mit Daumen runter ausgeblendet. Das Auge blendet ein Rezept wieder ein.</p>
                <div className="list">
                  {hiddenRecipes.map((r) => <RecipeRow key={r.id} recipe={r} saved={savedSet.has(r.id)} onToggleSave={savedSet.toggle} hidden onToggleHide={toggleHidden} />)}
                </div>
              </details>
            )}
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
                <button className="btn primary" onClick={() => navigate('alle')}>Rezepte ansehen</button>
              </div>
            ) : (
              <div className="grid" style={{ marginTop: 22 }}>{savedRecipes.map((r) => <RecipeCard key={r.id} {...card(r)} />)}</div>
            )}
            {savedUnfit > 0 && <p className="hint" style={{ marginTop: 16 }}>{savedUnfit} gespeicherte {savedUnfit === 1 ? 'Rezept passt' : 'Rezepte passen'} nicht zu deiner Ernährungsform und {savedUnfit === 1 ? 'wird' : 'werden'} ausgeblendet.</p>}
          </>
        )}
      </main>

      {undo && (
        <div className="undo" role="status">
          <span>{undo.message}</span>
          <button onClick={runUndo}>Rückgängig</button>
          <button className="undo-x" onClick={() => setUndo(null)} aria-label="Ausblenden">×</button>
        </div>
      )}
    </div>
  )
}
