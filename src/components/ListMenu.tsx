import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { RecipeList } from '../lib/lists'
import { IconCheck, IconPlus } from './Icons'

interface Props {
  /** Rezept, um das es geht – null heißt: Menü zu. */
  recipeId: string | null
  title: string
  /** Stelle auf dem Bildschirm, an der gedrückt wurde. */
  at: { x: number; y: number }
  lists: RecipeList[]
  saved: boolean
  onToggleSaved: () => void
  onToggleList: (listId: string) => void
  onNewList: () => void
  onClose: () => void
}

const RAND = 12
/** Unten sitzt die Tab-Leiste – so weit bleibt das Menü davon weg. */
const UNTEN = 84

/** Kleines Menü, das nach dem Halten einer Karte aufgeht: in welche Liste soll das Rezept? */
export function ListMenu({ recipeId, title, at, lists, saved, onToggleSaved, onToggleList, onNewList, onClose }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>({ left: -9999, top: -9999 })

  // Erst messen, dann setzen – sonst hängt das Menü über dem Rand.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!recipeId || !el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.min(Math.max(RAND, at.x - width / 2), window.innerWidth - width - RAND)
    const top = at.y + height + UNTEN > window.innerHeight
      ? Math.max(RAND, at.y - height - 8)
      : at.y + 8
    setPos({ left, top })
  }, [recipeId, at.x, at.y, lists.length])

  useEffect(() => {
    if (!recipeId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [recipeId, onClose])

  if (!recipeId) return null

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div className="card-menu" ref={boxRef} style={pos} role="menu" aria-label={`${title} einsortieren`}>
        <p className="card-menu-head">{title}</p>
        <button className={`multi-item ${saved ? 'on' : ''}`} role="menuitemcheckbox" aria-checked={saved} onClick={onToggleSaved}>
          <span className="box">{saved && <IconCheck width={14} height={14} />}</span>
          <span>Favoriten</span>
        </button>
        {lists.map((l) => {
          const drin = l.recipeIds.includes(recipeId)
          return (
            <button key={l.id} className={`multi-item ${drin ? 'on' : ''}`} role="menuitemcheckbox" aria-checked={drin} onClick={() => onToggleList(l.id)}>
              <span className="box">{drin && <IconCheck width={14} height={14} />}</span>
              <span>{l.name}</span>
            </button>
          )
        })}
        <button className="multi-item" role="menuitem" onClick={onNewList}>
          <span className="box plain"><IconPlus width={14} height={14} /></span>
          <span>Neue Liste …</span>
        </button>
      </div>
    </>
  )
}
