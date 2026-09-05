import { useRef, useState } from 'react'
import type { RecipeList } from '../lib/lists'
import { useScrollLock, useSwipeRight } from '../lib/swipe'
import { IconCheck, IconPlus, IconX } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  /** Rezept, das einsortiert wird – null heißt: nur Listen verwalten. */
  recipeId: string | null
  recipeTitle?: string
  lists: RecipeList[]
  onToggle: (listId: string, recipeId: string) => void
  onCreate: (name: string, recipeIds?: string[]) => string | null
}

/** Schublade von rechts: Rezept in eigene Listen legen oder eine neue Liste anlegen. */
export function ListPicker({ open, onClose, recipeId, recipeTitle, lists, onToggle, onCreate }: Props) {
  const [name, setName] = useState('')
  const asideRef = useRef<HTMLElement>(null)
  const dragX = useSwipeRight(asideRef, open, onClose)
  useScrollLock(open)

  const add = () => {
    if (!name.trim()) return
    onCreate(name, recipeId ? [recipeId] : [])
    setName('')
  }

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside ref={asideRef} className={`drawer ${open ? 'open' : ''} ${dragX ? 'dragging' : ''}`} aria-hidden={!open} aria-label="Listen"
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}>
        <div className="drawer-head">
          <h2>In welche Liste?</h2>
          <button className="btn icon sm" onClick={onClose} aria-label="Schließen"><IconX width={18} height={18} /></button>
        </div>
        {recipeTitle && <p className="hint">{recipeTitle}</p>}

        <div className="drawer-section">
          <div className="set-form">
            <input className="input-sm" placeholder="Neue Liste, z. B. Wochenplan" value={name} maxLength={60}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} aria-label="Name der neuen Liste" />
            <button className="btn sm primary" onClick={add} disabled={!name.trim()}><IconPlus width={16} height={16} /> Anlegen</button>
          </div>
        </div>

        <div className="drawer-section">
          {lists.length === 0 ? (
            <p className="hint">Noch keine Liste. Leg oben eine an – zum Beispiel „Wochenplan“ oder „Für Gäste“.</p>
          ) : (
            <ul className="set-list">
              {lists.map((l) => {
                const inList = recipeId ? l.recipeIds.includes(recipeId) : false
                return (
                  <li key={l.id} className={inList ? 'loaded' : ''}>
                    <button className="set-main" onClick={() => recipeId && onToggle(l.id, recipeId)} disabled={!recipeId}>
                      <b>{l.name}</b>
                      <small>{l.recipeIds.length} {l.recipeIds.length === 1 ? 'Rezept' : 'Rezepte'}</small>
                    </button>
                    {recipeId && (
                      <span className={`multi-item ${inList ? 'on' : ''}`} style={{ padding: 0, pointerEvents: 'none' }}>
                        <span className="box"><IconCheck width={14} height={14} /></span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
