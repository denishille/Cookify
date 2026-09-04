import type { CSSProperties } from 'react'
import type { Recipe } from '../types'
import { DIET_LABELS, DIFFICULTY_LABELS } from '../types'
import { openRecipe } from '../lib/router'
import { TILE_COLORS } from '../lib/tiles'
import { recipeImage } from '../lib/images'
import { formatRating } from '../lib/rating'
import { IconClock, IconEye, IconHeart, IconStar, IconThumbDown } from './Icons'

interface Props {
  recipe: Recipe
  saved: boolean
  onToggleSave: (id: string) => void
  hidden?: boolean
  onToggleHide?: (id: string) => void
}

/** Kompakte Listenzeile: Vorschaubild, Titel, Eckdaten, Herz. */
export function RecipeRow({ recipe, saved, onToggleSave, hidden, onToggleHide }: Props) {
  const img = recipeImage(recipe.id)
  return (
    <div className="row" role="link" tabIndex={0} onClick={() => openRecipe(recipe.id)} onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(recipe.id) }}>
      <div className={`row-thumb ${img ? 'photo' : ''}`} style={{ '--tile': TILE_COLORS[recipe.category] } as CSSProperties}>
        {img ? <img src={img} alt="" loading="lazy" decoding="async" /> : <span aria-hidden>{recipe.emoji}</span>}
      </div>
      <div className="row-body">
        <div className="row-title">{recipe.title}</div>
        <div className="meta">
          <IconClock /> {recipe.timeMinutes} Min
          <span className="dot" /> {DIFFICULTY_LABELS[recipe.difficulty]}
          <span className="dot" /> {recipe.nutrition.kcal} kcal
          {recipe.source?.rating !== undefined && <><span className="dot" /><IconStar width={13} height={13} style={{ color: 'var(--amber)' }} /> {formatRating(recipe.source.rating)}</>}
        </div>
      </div>
      <div className="row-pills">
        {recipe.diet.slice(0, 2).map((d) => <span key={d} className="pill green">{DIET_LABELS[d]}</span>)}
      </div>
      <div className="row-actions">
        <button className={`row-fav ${saved ? 'on' : ''}`} aria-label={saved ? 'Aus Gespeichert entfernen' : 'Rezept speichern'} aria-pressed={saved}
          onClick={(e) => { e.stopPropagation(); onToggleSave(recipe.id) }}>
          <IconHeart filled={saved} width={18} height={18} />
        </button>
        {onToggleHide && (
          <button className={`row-fav row-hide ${hidden ? 'on' : ''}`} aria-label={hidden ? 'Rezept wieder einblenden' : 'Rezept ausblenden'} title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
            onClick={(e) => { e.stopPropagation(); onToggleHide(recipe.id) }}>
            {hidden ? <IconEye width={18} height={18} /> : <IconThumbDown width={18} height={18} />}
          </button>
        )}
      </div>
    </div>
  )
}
