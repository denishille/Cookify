import type { Recipe } from '../types'
import { CATEGORY_LABELS, DIET_LABELS } from '../types'
import type { MatchResult } from '../lib/match'
import { openRecipe } from '../lib/router'

interface Props {
  recipe: Recipe
  saved: boolean
  onToggleSave: (id: string) => void
  match?: MatchResult
  isNew?: boolean
}

export function RecipeCard({ recipe, saved, onToggleSave, match, isNew }: Props) {
  const pct = match ? Math.round(match.score * 100) : null
  return (
    <article className="card" onClick={() => openRecipe(recipe.id)} role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(recipe.id) }}>
      {isNew && <span className="card-new">NEU</span>}
      <button
        className={`card-fav ${saved ? 'on' : ''}`}
        aria-label={saved ? 'Aus Gespeichert entfernen' : 'Rezept speichern'}
        onClick={(e) => { e.stopPropagation(); onToggleSave(recipe.id) }}
      >
        {saved ? '❤️' : '🤍'}
      </button>
      <div className="card-top">
        <div className="card-emoji" aria-hidden>{recipe.emoji}</div>
        <div className="card-head">
          <div className="card-title">{recipe.title}</div>
          <div className="card-meta">
            <span>⏱ {recipe.timeMinutes} Min</span>
            <span>{CATEGORY_LABELS[recipe.category]}</span>
            <span>{recipe.nutrition.kcal} kcal</span>
          </div>
        </div>
      </div>
      <p className="card-desc">{recipe.description}</p>
      {recipe.diet.length > 0 && (
        <div className="chips">
          {recipe.diet.slice(0, 3).map((d) => <span key={d} className="pill diet">{DIET_LABELS[d]}</span>)}
        </div>
      )}
      {match && pct !== null && (
        <>
          <div className="match-line">
            <span>{match.have.length} von {match.required.length} Zutaten da</span>
            <span style={{ color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct} %</span>
          </div>
          <div className={`match-bar ${pct < 100 ? 'partial' : ''}`}><div style={{ width: `${pct}%` }} /></div>
          {match.missing.length > 0 && (
            <div className="missing">Fehlt: <b>{match.missing.map((m) => m.name).join(', ')}</b></div>
          )}
        </>
      )}
    </article>
  )
}
