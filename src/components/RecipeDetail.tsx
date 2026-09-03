import { useEffect, useState } from 'react'
import type { Recipe } from '../types'
import { CATEGORY_LABELS, CUISINE_LABELS, DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import { STAPLE_KEYS } from '../data'
import { back, openRecipe } from '../lib/router'
import { formatWeek } from '../lib/week'

interface Props {
  recipe: Recipe
  saved: boolean
  onToggleSave: (id: string) => void
  pantry: Set<string>
  onTogglePantry: (key: string) => void
  related: Recipe[]
  isNew: boolean
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

export function RecipeDetail({ recipe, saved, onToggleSave, pantry, onTogglePantry, related, isNew }: Props) {
  const [servings, setServings] = useState(recipe.servings)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  // Die Komponente wird in App per key={recipe.id} neu aufgebaut, daher reicht hier das Scrollen.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [recipe.id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const factor = servings / recipe.servings
  const need = recipe.ingredients.filter((i) => !i.optional && !STAPLE_KEYS.has(i.key))
  const haveCount = need.filter((i) => pantry.has(i.key)).length

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setToast('Link kopiert')
    } catch {
      setToast('Teilen nicht möglich')
    }
  }

  const toggleStep = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="detail">
      <button className="btn ghost small" onClick={back}>← Zurück</button>
      <div className="detail-hero">
        <div className="detail-emoji" aria-hidden>{recipe.emoji}</div>
        <div>
          {isNew && <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 6, display: 'inline-block' }}>Neu · {formatWeek(recipe.addedWeek)}</span>}
          <h1>{recipe.title}</h1>
          <div className="card-meta" style={{ marginTop: 4 }}>
            <span>{CATEGORY_LABELS[recipe.category]}</span>
            <span>{CUISINE_LABELS[recipe.cuisine]}</span>
            <span>{DIFFICULTY_LABELS[recipe.difficulty]}</span>
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '1.02rem' }}>{recipe.description}</p>

      <div className="detail-actions">
        <button className={`btn ${saved ? '' : 'primary'}`} onClick={() => onToggleSave(recipe.id)}>
          {saved ? '❤️ Gespeichert' : '🤍 Speichern'}
        </button>
        <button className="btn" onClick={share}>🔗 Teilen</button>
      </div>

      <div className="chips">
        {recipe.diet.map((d) => <span key={d} className="pill diet">{DIET_LABELS[d]}</span>)}
        {recipe.tags.map((t) => <span key={t} className="pill">#{t}</span>)}
      </div>

      <div className="facts">
        <div className="fact"><b>{recipe.timeMinutes}</b><span>Minuten</span></div>
        <div className="fact"><b>{recipe.nutrition.kcal}</b><span>kcal / Port.</span></div>
        <div className="fact"><b>{recipe.nutrition.protein} g</b><span>Protein</span></div>
        <div className="fact"><b>{recipe.nutrition.carbs} g</b><span>Kohlenhydrate</span></div>
        <div className="fact"><b>{recipe.nutrition.fat} g</b><span>Fett</span></div>
      </div>

      <div className="section-title" style={{ justifyContent: 'space-between' }}>
        <span>Zutaten <span className="count">{haveCount}/{need.length} im Vorrat</span></span>
        <span className="servings">
          <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Weniger Portionen">−</button>
          <span style={{ minWidth: 88, textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>{servings} {servings === 1 ? 'Portion' : 'Portionen'}</span>
          <button onClick={() => setServings((s) => Math.min(24, s + 1))} aria-label="Mehr Portionen">+</button>
        </span>
      </div>
      <div className="panel">
        <ul className="ing-list">
          {recipe.ingredients.map((ing, i) => {
            const staple = STAPLE_KEYS.has(ing.key)
            const has = pantry.has(ing.key)
            return (
              <li key={i}>
                <span className="amt">{formatAmount(ing.amount, factor)} {ing.unit}</span>
                <span>
                  {ing.name}
                  {ing.optional && <span className="opt"> (optional)</span>}
                </span>
                {!staple && (
                  <button className={has ? 'have' : 'lack'} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    onClick={() => onTogglePantry(ing.key)} title="Im Vorrat umschalten">
                    {has ? '✓ vorhanden' : '+ hab ich'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="section-title">Zubereitung <span className="count">{done.size}/{recipe.steps.length}</span></div>
      <div className="panel">
        <ol className="steps">
          {recipe.steps.map((s, i) => (
            <li key={i} className={done.has(i) ? 'done' : ''} onClick={() => toggleStep(i)}>{s}</li>
          ))}
        </ol>
      </div>

      {related.length > 0 && (
        <>
          <div className="section-title">Das könnte dir auch schmecken</div>
          <div className="chips">
            {related.map((r) => (
              <button key={r.id} className="chip" onClick={() => openRecipe(r.id)}>{r.emoji} {r.title}</button>
            ))}
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
