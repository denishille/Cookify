import { useEffect, useRef, useState } from 'react'
import type { Diet } from '../types'
import type { ShoppingItem } from '../lib/shopping'
import { IngredientPicker } from './IngredientPicker'
import { IconCheck, IconX } from './Icons'
import { useScrollLock, useSwipeRight } from '../lib/swipe'

interface Props {
  open: boolean
  onClose: () => void
  items: ShoppingItem[]
  onToggleDone: (id: string) => void
  onRemove: (id: string) => void
  onClearDone: () => void
  onClearAll: () => void
  onAddKey: (key: string) => void
  diets: readonly Diet[]
}

function amountText(x: ShoppingItem): string {
  if (x.amount === null) return ''
  const v = Number.isInteger(x.amount) ? String(x.amount) : x.amount.toFixed(1).replace('.', ',')
  return `${v} ${x.unit}`.trim()
}

/** Einkaufsliste als Schublade von rechts. */
export function ShoppingDrawer({ open, onClose, items, onToggleDone, onRemove, onClearDone, onClearAll, onAddKey, diets }: Props) {
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const asideRef = useRef<HTMLElement>(null)
  useSwipeRight(asideRef, open, onClose)
  useScrollLock(open)

  const recipes = [...new Set(items.filter((x) => !x.done && x.from).map((x) => x.from as string))]
  const openItems = items.filter((x) => !x.done)
  const doneItems = items.filter((x) => x.done)
  const selectedKeys = new Set(openItems.map((x) => x.key))

  const row = (x: ShoppingItem) => (
    <li key={x.id} className={x.done ? 'done' : ''}>
      <button className={`have ${x.done ? 'on' : ''}`} onClick={() => onToggleDone(x.id)} aria-label={x.done ? 'Wieder offen' : 'Gekauft'} aria-pressed={x.done}>
        <IconCheck width={16} height={16} />
      </button>
      <span className="amt">{amountText(x)}</span>
      <span className="nm">{x.name}{x.from && <small>{x.from}</small>}</span>
      <button className="btn icon sm ghost" onClick={() => onRemove(x.id)} aria-label={`${x.name} entfernen`}><IconX width={16} height={16} /></button>
    </li>
  )

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside ref={asideRef} className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Einkaufsliste">
        <div className="drawer-head">
          <h2>Einkaufsliste{openItems.length > 0 && <span className="count-pill">{openItems.length}</span>}</h2>
          <button className="btn icon sm" onClick={onClose} aria-label="Schließen"><IconX width={18} height={18} /></button>
        </div>

        <div className="drawer-section">
          {!adding
            ? <button className="btn soft" onClick={() => setAdding(true)}>+ Zutat hinzufügen</button>
            : (
              <>
                <IngredientPicker selected={selectedKeys} onToggle={(k) => onAddKey(k)} placeholder="Zutat suchen …" diets={diets} />
                <button className="btn sm" onClick={() => setAdding(false)}>Fertig</button>
              </>
            )}
          {recipes.length > 0
            ? <p className="hint">Hier findest du die Zutaten für: <b>{recipes.join(', ')}</b></p>
            : <p className="hint">Ganze Rezepte kommen über „Auf die Einkaufsliste“ auf der Rezeptseite dazu, einzelne Zutaten dort über das Korb-Symbol.</p>}
        </div>

        {items.length === 0 ? (
          <div className="drawer-section"><span className="hint">Die Liste ist leer.</span></div>
        ) : (
          <>
            <ul className="shop-list">{openItems.map(row)}</ul>
            {doneItems.length > 0 && (
              <div className="drawer-section">
                <span className="eyebrow">Gekauft · {doneItems.length}</span>
                <ul className="shop-list">{doneItems.map(row)}</ul>
              </div>
            )}
            <div className="drawer-foot">
              {doneItems.length > 0 && <button className="btn sm" onClick={onClearDone}>Gekaufte entfernen</button>}
              <button className="btn sm ghost" onClick={onClearAll}>Liste leeren</button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
