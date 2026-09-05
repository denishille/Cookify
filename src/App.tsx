import { useEffect, useRef, useState } from 'react'
import { ALL_RECIPES, INGREDIENT_BY_KEY } from './data'
import type { Diet, Recipe } from './types'
import { useRoute, back, navigate, openRecipe, type View } from './lib/router'
import { readStored, useSessionSet, usePersistentSet, usePersistentState } from './lib/storage'
import { isoWeek } from './lib/week'
import { autoMatch, ALL_MATCHES } from './lib/match'
import { applyFilters, isEmpty, rankByQuery, EMPTY_FILTERS, type FilterState } from './lib/filters'
import { ratingScore } from './lib/rating'
import { dailyPicks } from './lib/daily'
import { adaptRecipe } from './lib/adapt'
import { DEFAULT_SETS, type PantrySet } from './lib/sets'
import { RecipeCard } from './components/RecipeCard'
import { RecipeRow } from './components/RecipeRow'
import { RecipeDetail } from './components/RecipeDetail'
import { PantryPicker } from './components/PantryPicker'
import { ScrollStrip } from './components/ScrollStrip'
import { useScrollMemory } from './lib/scrollMemory'
import { SetsDrawer } from './components/SetsDrawer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ShoppingDrawer } from './components/ShoppingDrawer'
import { useShoppingList } from './lib/shopping'
import { FilterGroups } from './components/Filters'
import { IconBasket, IconBook, IconCart, IconChevronDown, IconChevronLeft, IconDice, IconHeart, IconSearch, IconSettings, IconX } from './components/Icons'
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
  const [sets, setSets] = usePersistentState<PantrySet[]>('cookify.sets', DEFAULT_SETS)
  /** Welche Sets geladen sind – nur das überlebt einen Neustart, nicht die einzelnen Zutaten. */
  const [loadedSets, setLoadedSets] = usePersistentState<string[]>('cookify.loadedSets', [])
  /** Der Vorrat selbst gilt nur für diese Sitzung und startet mit dem, was in den geladenen Sets steht. */
  const pantrySet = useSessionSet(() => {
    const ids = readStored<string[]>('cookify.loadedSets', [])
    const stored = readStored<PantrySet[]>('cookify.sets', DEFAULT_SETS)
    return [...new Set(stored.filter((s) => ids.includes(s.id)).flatMap((s) => s.keys))]
  })
  const [setsOpen, setSetsOpen] = useState(false)

  /** Rückgängig-Leiste: letzte Löschaktion mit Wiederherstellen, verschwindet nach 8 Sekunden. */
  const [undo, setUndo] = useState<{ message: string; restore?: () => void } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 8000)
    return () => clearTimeout(t)
  }, [undo])
  const offerUndo = (message: string, restore: () => void) => setUndo({ message, restore })
  const runUndo = () => { undo?.restore?.(); setUndo(null) }
  const toggleHidden = (id: string) => {
    if (!hiddenSet.has(id)) offerUndo(`„${BY_ID.get(id)?.title ?? id}“ ausgeblendet`, () => hiddenSet.replace([...hiddenSet.set].filter((x) => x !== id)))
    hiddenSet.toggle(id)
  }

  const applySet = (st: PantrySet) => {
    pantrySet.replace([...pantrySet.set, ...st.keys])
    setLoadedSets((prev) => (prev.includes(st.id) ? prev : [...prev, st.id]))
  }
  const togglePantry = (key: string) => {
    if (pantrySet.has(key)) {
      const name = INGREDIENT_BY_KEY.get(key)?.name ?? key
      offerUndo(`${name} aus dem Vorrat entfernt`, () => pantrySet.replace([...pantrySet.set, key]))
    }
    pantrySet.toggle(key)
  }
  /** Zutaten aus den geladenen Sets – die bleiben beim Aufräumen stehen. */
  const setKeys = [...new Set(sets.filter((s) => loadedSets.includes(s.id)).flatMap((s) => s.keys))]
  const extraKeys = [...pantrySet.set].filter((k) => !setKeys.includes(k))
  /** „Alles entfernen“ räumt nur die von Hand ergänzten Zutaten weg – die geladenen Sets bleiben. */
  const clearPantry = () => {
    const before = [...pantrySet.set]
    if (before.length === 0) return
    if (extraKeys.length === 0) return
    offerUndo(`${extraKeys.length} ${extraKeys.length === 1 ? 'Zutat' : 'Zutaten'} entfernt`, () => pantrySet.replace(before))
    pantrySet.replace(setKeys)
  }
  const saveSet = (next: PantrySet) => {
    const before = sets.find((x) => x.id === next.id)
    setSets((prev) => (prev.some((x) => x.id === next.id) ? prev.map((x) => (x.id === next.id ? next : x)) : [...prev, next]))
    // Ist das Set gerade im Vorrat, wandern Änderungen direkt mit hinein.
    if (before && before.keys.every((k) => pantrySet.set.has(k))) {
      const removed = before.keys.filter((k) => !next.keys.includes(k))
      pantrySet.replace([...[...pantrySet.set].filter((k) => !removed.includes(k)), ...next.keys])
    }
  }
  const deleteSet = (id: string) => {
    const idx = sets.findIndex((x) => x.id === id)
    if (idx < 0) return
    const removed = sets[idx]
    offerUndo(`Set „${removed.name}“ gelöscht`, () => setSets((prev) => (prev.some((x) => x.id === removed.id) ? prev : [...prev.slice(0, idx), removed, ...prev.slice(idx)])))
    setSets((prev) => prev.filter((x) => x.id !== id))
    setLoadedSets((prev) => prev.filter((x) => x !== id))
  }
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>('standard')

  /** Globale Ernährungsform aus den Einstellungen: filtert den gesamten Bestand, bleibt im Browser gespeichert. */
  const [globalDiets, setGlobalDiets] = usePersistentState<Diet[]>('cookify.globalDiets', [])
  const [adaptOn, setAdaptOn] = usePersistentState<boolean>('cookify.adapt', true)
  const [strictFructose, setStrictFructose] = usePersistentState<boolean>('cookify.strictFructose', false)
  const dietOpts = { adapt: adaptOn, strictFructose }
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
  const AVAILABLE = ALL_RECIPES.filter((r) => !hiddenSet.has(r.id) && adaptRecipe(r, globalDiets, dietOpts).ok)
  const hiddenRecipes = [...hiddenSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))
  const DAILY = dailyPicks(AVAILABLE, 5)

  /** Alle-Rezepte-Liste: eigene Filter und Sortierung */
  const [allFilters, setAllFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [allSort, setAllSort] = useState<Sort>('standard')
  const allBase = applyFilters(AVAILABLE, allFilters, dietOpts)
  const allList = allSort === 'standard'
    ? (allFilters.query.trim() ? rankByQuery(allBase, allFilters.query) : [...allBase].sort((a, b) => a.title.localeCompare(b.title, 'de')))
    : sortRecipes(allBase, allSort)

  const pantryKey = [...pantrySet.set].sort().join(',')
  const pantryMatch = autoMatch(AVAILABLE, new Set(pantryKey ? pantryKey.split(',') : []))
  const pantryResults = pantryMatch.results

  /** Treffer gibt es nur, wenn im Konfigurator etwas gesetzt ist. */
  const configured = !isEmpty(filters)
  const results = sortRecipes(applyFilters(AVAILABLE, filters, dietOpts), sort)

  const savedAll = [...savedSet.set].map((id) => BY_ID.get(id)).filter((r): r is Recipe => Boolean(r))
  const savedRecipes = savedAll.filter((r) => adaptRecipe(r, globalDiets, dietOpts).ok)
  const savedUnfit = savedAll.length - savedRecipes.length
  const detail = route.recipeId ? BY_ID.get(route.recipeId) : null
  // Beim Zurück landet man wieder an der Stelle, an der man weggeklickt hat.
  const mainRef = useRef<HTMLElement>(null)
  useScrollMemory(route.recipeId ? `rezept:${route.recipeId}` : `view:${route.view}`, mainRef, 'y')

  const surprise = () => {
    const pool = results.length ? results : AVAILABLE
    openRecipe(randomOf(pool).id)
  }

  /** Die ausgeblendeten Rezepte als Liste in die Zwischenablage – zum Weiterschicken. */
  const copyHidden = async () => {
    const text = hiddenRecipes.map((r) => `${r.id}  ${r.title}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setUndo({ message: `${hiddenRecipes.length} Rezepte kopiert` })
    } catch {
      setUndo({ message: 'Kopieren nicht möglich' })
    }
  }

  /** Alle gerade wirksamen Ernährungsformen: Einstellungen plus die Filter der einzelnen Seiten. */
  const activeDiets: Diet[] = [...new Set<Diet>([...globalDiets, ...filters.diets, ...allFilters.diets])]
  const adaptedCount = (r: Recipe) => adaptRecipe(r, activeDiets, dietOpts).changes.length
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
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} globalDiets={globalDiets} onChange={setGlobalDiets}
        adapt={adaptOn} onAdaptChange={setAdaptOn} strictFructose={strictFructose} onStrictFructoseChange={setStrictFructose} />
      <ShoppingDrawer open={shopOpen} onClose={() => setShopOpen(false)} items={shopping.items} onToggleDone={shopping.toggleDone} onRemove={shopping.remove}
        onClearDone={shopping.clearDone} onClearAll={shopping.clearAll} onAddKey={addShoppingKey} diets={globalDiets} />
      <main className="main" ref={mainRef}>

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
            hidden={hiddenSet.has(detail.id)}
            onToggleHide={toggleHidden}
            dietOpts={dietOpts}
            onAddIngredientToList={(ing) => shopping.addIngredient(ing, detail.title)}
            onAddRecipeToList={(factor) => shopping.addRecipe(detail, pantrySet.set, factor)}
          />
        )}

        {!route.recipeId && route.view === 'rezepte' && (
          <>
            <h1 className="h1">Was kochen wir heute?</h1>
            <FilterGroups value={filters} onChange={setFilters} pool={AVAILABLE} globalDiets={globalDiets}>
              <button className="btn primary block" onClick={() => navigate('alle')}>Alle Rezepte</button>
            </FilterGroups>

            {!configured && (
              <div className="section">
                <div className="section-head"><h2>Vorschläge des Tages</h2></div>
                <ScrollStrip storeKey="daily">
                  {DAILY.map((r) => <RecipeCard key={r.id} {...card(r)} />)}
                </ScrollStrip>
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
                <PantryPicker pantry={pantrySet.set} onToggle={togglePantry} onClear={extraKeys.length > 0 ? clearPantry : undefined} diets={globalDiets} />
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
                      <span className="hint">
                        {pantryResults.length} Treffer
                        {pantryResults.length > 0 && (pantryMatch.tolerance === 0 ? ' · alles da'
                          : pantryMatch.tolerance >= ALL_MATCHES ? ' · alles, was dazu passt'
                          : ` · bis zu ${pantryMatch.tolerance} ${pantryMatch.tolerance === 1 ? 'Zutat fehlt' : 'Zutaten fehlen'}`)}
                      </span>
                    </div>
                    <div style={{ height: 4 }} />
                    {pantryResults.length === 0 ? (
                      <div className="empty">
                        <h3>Noch kein passendes Rezept</h3>
                        <p>Füge noch ein, zwei Zutaten hinzu, dann wird es leichter.</p>
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
            <button className="backlink" onClick={back}><IconChevronLeft /> Zurück</button>
            <div className="section-head" style={{ marginTop: 6 }}>
              <h1 className="h1">Alle Rezepte</h1>
              <span className="sub">{allList.length} {allList.length === 1 ? 'Rezept' : 'Rezepte'}</span>
            </div>
            <div className="searchbox" style={{ marginTop: 16 }}>
              <IconSearch />
              <input
                type="text"
                placeholder="Rezept oder Zutat suchen …"
                value={allFilters.query}
                onChange={(e) => setAllFilters({ ...allFilters, query: e.target.value })}
                aria-label="Rezepte durchsuchen"
                autoComplete="off"
              />
              {allFilters.query && (
                <button className="clear" onClick={() => setAllFilters({ ...allFilters, query: '' })} aria-label="Suche löschen">
                  <IconX width={16} height={16} />
                </button>
              )}
            </div>
            <FilterGroups value={allFilters} onChange={setAllFilters} hideTime pool={AVAILABLE} globalDiets={globalDiets}>
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
              <div className="empty" style={{ marginTop: 18 }}>
                <div className="ico"><IconSearch /></div>
                <h3>Nichts gefunden</h3>
                <p>{allFilters.query.trim() ? `Für „${allFilters.query.trim()}“ gibt es kein Rezept. Versuch ein anderes Wort.` : 'Nimm einen Filter raus.'}</p>
              </div>
            ) : (
              <div className="list" style={{ marginTop: 18 }}>
                {allList.map((r) => <RecipeRow key={r.id} recipe={r} saved={savedSet.has(r.id)} onToggleSave={savedSet.toggle} onToggleHide={toggleHidden} adapted={adaptedCount(r)} />)}
              </div>
            )}
            {hiddenRecipes.length > 0 && (
              <details className="hidden-box">
                <summary><IconChevronDown width={18} height={18} /> Ausgeblendete Rezepte <span className="count">{hiddenRecipes.length}</span></summary>
                <p className="hint">Mit Daumen runter ausgeblendet. Das Auge blendet ein Rezept wieder ein.</p>
                <button className="btn sm" onClick={copyHidden}>Liste kopieren</button>
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

      {tabs('tabbar')}

      {undo && (
        <div className="undo" role="status">
          <span>{undo.message}</span>
          {undo.restore && <button onClick={runUndo}>Rückgängig</button>}
          <button className="undo-x" onClick={() => setUndo(null)} aria-label="Ausblenden">×</button>
        </div>
      )}
    </div>
  )
}
