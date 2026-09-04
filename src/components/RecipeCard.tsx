import type { CSSProperties } from 'react'
import type { Recipe } from '../types'
import { DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import type { MatchResult } from '../lib/match'
import { openRecipe } from '../lib/router'
import { TILE_COLORS } from '../lib/tiles'
import { recipeImage } from '../lib/images'
import { IconClock, IconEye, IconHeart, IconStar, IconThumbDown } from './Icons'
import { formatCount, formatRating } from '../lib/rating'

interface Props {
  recipe: Recipe
  saved: boolean
  onToggleSave: (id: string) => void
  match?: MatchResult
  isNew?: boolean
  hidden?: boolean
  onToggleHide?: (id: string) => void
}

export function RecipeCard({ recipe, saved, onToggleSave, match, isNew, hidden, onToggleHide }: Props) {
  const pct = match ? Math.round(match.score * 100) : null
  const img = recipeImage(recipe.id)
  return (
    <article
      className="card"
      role="link"
      tabIndex={0}
      onClick={() => openRecipe(recipe.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(recipe.id) }}
    >
      <div className={`tile ${img ? 'photo' : ''}`} style={{ '--tile': TILE_COLORS[recipe.category] } as CSSProperties}>
        {isNew && <span className="badge-new">Neu</span>}
        {img ? <img src={img} alt="" loading="lazy" decoding="async" /> : <span className="tile-emoji" aria-hidden>{recipe.emoji}</span>}
        <button
          className={`fav ${saved ? 'on' : ''}`}
          aria-label={saved ? 'Aus Gespeichert entfernen' : 'Rezept speichern'}
          aria-pressed={saved}
          onClick={(e) => { e.stopPropagation(); onToggleSave(recipe.id) }}
        >
          <IconHeart filled={saved} width={18} height={18} />
        </button>
        {onToggleHide && (
          <button
            className={`fav fav-hide ${hidden ? 'on' : ''}`}
            aria-label={hidden ? 'Rezept wieder einblenden' : 'Rezept ausblenden'}
            title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
            onClick={(e) => { e.stopPropagation(); onToggleHide(recipe.id) }}
          >
            {hidden ? <IconEye width={18} height={18} /> : <IconThumbDown width={18} height={18} />}
          </button>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{recipe.title}</h3>
        <p className="card-sub">{recipe.description}</p>
        <div className="meta">
          <IconClock /> {recipe.timeMinutes} Min
          <span className="dot" /> {DIFFICULTY_LABELS[recipe.difficulty]}
          <span className="dot" /> {recipe.nutrition.kcal} kcal
        </div>
        {recipe.source?.rating !== undefined && (
          <div className="rating">
            <IconStar width={14} height={14} />
            <b>{formatRating(recipe.source.rating)}</b>
            {recipe.source.ratingCount !== undefined && <span>({formatCount(recipe.source.ratingCount)})</span>}
            <span className="site">{recipe.source.site}</span>
          </div>
        )}
        {recipe.diet.length > 0 && !match && (
          <div className="pills">
            {recipe.diet.slice(0, 2).map((d) => <span key={d} className="pill green">{DIET_LABELS[d]}</span>)}
          </div>
        )}
        {match && pct !== null && (
          <div className="match">
            <div className="match-line">
              <span>{match.have.length} von {match.required.length} Zutaten da</span>
              <span style={{ color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct} %</span>
            </div>
            <div className={`match-bar ${pct < 100 ? 'partial' : ''}`}><div style={{ width: `${pct}%` }} /></div>
            {match.missing.length > 0 && (
              <div className="match-missing">Fehlt: <b>{match.missing.map((m) => m.name).join(', ')}</b></div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
