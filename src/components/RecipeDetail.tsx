import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Diet, Ingredient, Recipe } from '../types'
import { CATEGORY_LABELS, CUISINE_LABELS, DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import { STAPLE_KEYS } from '../data'
import { back } from '../lib/router'
import { TILE_COLORS } from '../lib/tiles'
import { recipeImage } from '../lib/images'
import { RecipeCard } from './RecipeCard'
import { IconCart, IconCheck, IconClock, IconExternal, IconEye, IconFlame, IconGauge, IconGlobe, IconHeart, IconLayers, IconMinus, IconPlus, IconShare, IconStar, IconThumbDown } from './Icons'
import { formatCount, formatRating, isTopRated } from '../lib/rating'
import { adaptRecipe, recipeFructose, type DietOptions } from '../lib/adapt'
import { useSwipeRight } from '../lib/swipe'
import { shareLink } from '../lib/share'

interface Props {
  recipe: Recipe
  saved: boolean
  onToggleSave: (id: string) => void
  pantry: Set<string>
  onTogglePantry: (key: string) => void
  related: Recipe[]
  isNew: boolean
  savedIds: Set<string>
  activeDiets: Diet[]
  hidden?: boolean
  onToggleHide?: (id: string) => void
  dietOpts?: DietOptions
  onAddIngredientToList: (ing: Ingredient) => void
  onAddRecipeToList: (factor: number) => number
  /** Öffnet die Auswahl der eigenen Listen. */
  onPickList: () => void
  /** In wie vielen eigenen Listen liegt das Rezept? */
  inLists: number
}

/** Gramm mit einer Nachkommastelle, deutsch geschrieben. */
function formatGrams(g: number): string {
  return `${(Math.round(g * 10) / 10).toLocaleString('de-DE')} g`
}

function formatAmount(amount: number | null, factor: number): string {
  if (amount === null) return ''
  const v = amount * factor
  if (v === 0) return ''
  const whole = Math.floor(v)
  const frac = v - whole
  const fracs: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.66, '⅔'], [0.75, '¾']]
  const near = fracs.find(([f]) => Math.abs(frac - f) < 0.07)
  if (v >= 10) return String(Math.round(v))
  if (near) return `${whole || ''}${near[1]}`
  if (frac < 0.07) return String(whole)
  return v.toFixed(1).replace('.', ',')
}

export function RecipeDetail({ recipe, saved, onToggleSave, pantry, onTogglePantry, related, isNew, savedIds, activeDiets, hidden = false, onToggleHide, dietOpts = {}, onAddIngredientToList, onAddRecipeToList, onPickList, inLists }: Props) {
  const [servings, setServings] = useState(recipe.servings)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const adaptation = adaptRecipe(recipe, activeDiets, dietOpts)
  const fructose = recipeFructose(recipe, true)
  const changeByKey = new Map(adaptation.ok && !showOriginal ? adaptation.changes.map((c) => [c.key, c]) : [])
  const adaptedDiets = [...new Set(adaptation.changes.map((c) => DIET_LABELS[c.diet]))]

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const img = recipeImage(recipe.id)
  const factor = servings / recipe.servings
  const need = recipe.ingredients.filter((i) => !i.optional && !STAPLE_KEYS.has(i.key))
  const haveCount = need.filter((i) => pantry.has(i.key)).length

  const share = async () => {
    const msg = await shareLink(recipe.title, window.location.href)
    if (msg) setToast(msg)
  }

  /** Nach rechts wischen geht zurück, wie in den Schubladen. */
  const rootRef = useRef<HTMLDivElement>(null)
  useSwipeRight(rootRef, true, back)

  const toggleStep = (i: number) =>
    setDone((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })

  return (
    <div className="detail" ref={rootRef}>

      <div className={`tile lg ${img ? 'photo' : ''}`} style={{ '--tile': TILE_COLORS[recipe.category] } as CSSProperties}>
        {isNew && <span className="badge-new">Neu diese Woche</span>}
        {img ? <img src={img} alt={recipe.title} decoding="async" /> : <span className="tile-emoji" aria-hidden>{recipe.emoji}</span>}
        <button className={`fav ${saved ? 'on' : ''}`} aria-label={saved ? 'Aus Gespeichert entfernen' : 'Rezept speichern'} aria-pressed={saved} onClick={() => onToggleSave(recipe.id)}>
          <IconHeart filled={saved} />
        </button>
        {onToggleHide && (
          <button className={`fav fav-hide ${hidden ? 'on' : ''}`} title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
            aria-label={hidden ? 'Rezept wieder einblenden' : 'Rezept ausblenden'} aria-pressed={hidden}
            onClick={() => { onToggleHide(recipe.id); setToast(hidden ? 'Wieder eingeblendet' : 'Ausgeblendet, du findest es unter Alle Rezepte') }}>
            {hidden ? <IconEye /> : <IconThumbDown />}
          </button>
        )}
      </div>

      <div className="detail-head">
        <span className="eyebrow">{CATEGORY_LABELS[recipe.category]}</span>
        <h1>{recipe.title}</h1>
        <p className="lead">{recipe.description}</p>
        <div className="facts">
          <span><IconClock /> {recipe.timeMinutes} Min</span>
          <span><IconGauge /> {DIFFICULTY_LABELS[recipe.difficulty]}</span>
          <span><IconFlame /> {recipe.nutrition.kcal} kcal / Portion</span>
          <span><IconGlobe /> {CUISINE_LABELS[recipe.cuisine]}</span>
        </div>
        <div className="pills">
          {recipe.diet.map((d) => <span key={d} className="pill green">{DIET_LABELS[d]}</span>)}
          {recipe.tags.map((t) => <span key={t} className="pill">{t}</span>)}
        </div>
        {recipe.source && (
          <a className="source-box" href={recipe.source.url} target="_blank" rel="noopener noreferrer">
            <span className="source-star"><IconStar /></span>
            <span className="source-text">
              {recipe.source.rating !== undefined ? (
                <>
                  <b>{formatRating(recipe.source.rating)} von 5</b>
                  {recipe.source.ratingCount !== undefined && <> bei {formatCount(recipe.source.ratingCount)} Bewertungen</>}
                  {' '}auf {recipe.source.site}{isTopRated(recipe) && ' · Community-Favorit'}
                </>
              ) : (
                <>Vorbild auf {recipe.source.site}</>
              )}
              <small>Unsere eigene Version. Original ansehen</small>
            </span>
            <IconExternal />
          </a>
        )}
        <div className="actions">
          <button className={`btn ${saved ? '' : 'primary'}`} onClick={() => onToggleSave(recipe.id)}>
            <IconHeart filled={saved} width={18} height={18} /> {saved ? 'Gespeichert' : 'Speichern'}
          </button>
          <button className={`btn ${inLists ? 'on' : ''}`} onClick={onPickList}>
            <IconLayers width={18} height={18} /> {inLists ? `In ${inLists} ${inLists === 1 ? 'Liste' : 'Listen'}` : 'Zu Liste'}
          </button>
          <button className="btn" onClick={share}><IconShare width={18} height={18} /> Teilen</button>
          <button className="btn" onClick={() => { const n = onAddRecipeToList(factor); setToast(n ? `${n} ${n === 1 ? 'Zutat' : 'Zutaten'} auf der Einkaufsliste` : 'Alles schon im Vorrat') }}>
            <IconCart width={18} height={18} /> Auf die Einkaufsliste
          </button>
        </div>
      </div>

      {adaptation.ok && adaptation.changes.length > 0 && (
        <div className="adapt-box">
          <div>
            <b>Für dich angepasst · {adaptedDiets.join(', ')}</b>
            <small>{adaptation.changes.length} {adaptation.changes.length === 1 ? 'Zutat ist' : 'Zutaten sind'} angepasst, in der Zutatenliste steht wie.</small>
          </div>
          <button className="btn sm" onClick={() => setShowOriginal((o) => !o)}>{showOriginal ? 'Angepasst zeigen' : 'Original zeigen'}</button>
        </div>
      )}
      {!adaptation.ok && activeDiets.length > 0 && (
        <div className="adapt-box warn">
          <div><b>Passt nicht zu deiner Ernährungsform</b><small>{adaptation.reason}.</small></div>
        </div>
      )}

      <div className="detail-cols">
        <section>
          <div className="col-head">
            <h2>Zutaten</h2>
            <div className="stepper">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Weniger Portionen"><IconMinus width={16} height={16} /></button>
              <span>{servings} {servings === 1 ? 'Portion' : 'Portionen'}</span>
              <button onClick={() => setServings((s) => Math.min(24, s + 1))} aria-label="Mehr Portionen"><IconPlus width={16} height={16} /></button>
            </div>
          </div>
          <p className="hint" style={{ marginBottom: 6 }}>{haveCount} von {need.length} Zutaten im Vorrat. Tipp auf den Kreis, um eine Zutat als vorhanden zu markieren.</p>
          <ul className="ing">
            {recipe.ingredients.map((ing, i) => {
              const has = pantry.has(ing.key)
              const change = changeByKey.get(ing.key)
              return (
                <li key={i} className={change ? `changed ${change.action}` : ''}>
                  <span className="amt">{formatAmount(ing.amount, factor)} {ing.unit}</span>
                  <span className="nm">
                    <span className={change ? 'orig' : ''}>{ing.name}</span>{ing.optional && <span className="opt"> · optional</span>}
                    {change && (
                      <span className="sub">
                        {change.action === 'ersetzen' ? `→ ${change.by}`
                          : change.action === 'weniger' ? `→ höchstens ${Math.round((change.limit ?? 0) * servings)} g insgesamt`
                          : '→ weglassen'}
                        {change.note && <em>{change.note}</em>}
                      </span>
                    )}
                  </span>
                  <button className="ing-cart" onClick={() => { onAddIngredientToList({ ...ing, amount: ing.amount === null ? null : Math.round(ing.amount * factor * 10) / 10 }); setToast(`${ing.name} auf der Einkaufsliste`) }} aria-label={`${ing.name} auf die Einkaufsliste`} title="Auf die Einkaufsliste">
                    <IconCart width={16} height={16} />
                  </button>
                  <button
                    className={`have ${has ? 'on' : ''}`}
                    onClick={() => onTogglePantry(ing.key)}
                    aria-label={has ? `${ing.name} aus dem Vorrat entfernen` : `${ing.name} zum Vorrat hinzufügen`}
                    aria-pressed={has}
                  >
                    <IconCheck width={16} height={16} />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="nutrition">
            <span className="lbl">Nährwerte pro Portion</span>
            <div><b>{recipe.nutrition.kcal}</b><small>kcal</small></div>
            <div><b>{recipe.nutrition.protein} g</b><small>Protein</small></div>
            <div><b>{recipe.nutrition.carbs} g</b><small>Kohlenhydrate</small></div>
            <div><b>{recipe.nutrition.fat} g</b><small>Fett</small></div>
            <div><b>{formatGrams(fructose)}</b><small>Fruchtzucker</small></div>
          </div>
        </section>

        <section>
          <div className="col-head">
            <h2>Zubereitung</h2>
            <span className="hint">{done.size}/{recipe.steps.length} erledigt</span>
          </div>
          <ol className="steps">
            {recipe.steps.map((s, i) => (
              <li key={i} className={done.has(i) ? 'done' : ''} onClick={() => toggleStep(i)}><p>{s}</p></li>
            ))}
          </ol>
        </section>
      </div>

      {related.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Das könnte dir auch schmecken</h2></div>
          <div className="related">
            {related.map((r) => <RecipeCard key={r.id} recipe={r} saved={savedIds.has(r.id)} onToggleSave={onToggleSave} />)}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
