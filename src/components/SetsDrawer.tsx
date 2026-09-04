import { useEffect, useRef, useState } from 'react'
import type { Diet } from '../types'
import type { PantrySet } from '../lib/sets'
import { slugId } from '../lib/sets'
import { INGREDIENT_BY_KEY } from '../data'
import { IngredientPicker } from './IngredientPicker'
import { IconChevronLeft, IconLayers, IconPlus, IconX } from './Icons'

interface Props {
  open: boolean
  onOpen: () => void
  onClose: () => void
  pantry: Set<string>
  sets: PantrySet[]
  onApplySet: (set: PantrySet) => void
  onSaveSet: (set: PantrySet) => void
  onDeleteSet: (id: string) => void
  diets: readonly Diet[]
}

/** Griff am rechten Rand plus Schublade, die von rechts hereinfährt. Sets laden, anlegen, bearbeiten, löschen. */
export function SetsDrawer({ open, onOpen, onClose, pantry, sets, onApplySet, onSaveSet, onDeleteSet, diets }: Props) {
  const [editing, setEditing] = useState<PantrySet | null>(null)

  const close = () => { setEditing(null); onClose() }

  /** Wischen nach rechts schließt die Schublade; sie folgt dabei dem Finger. Native Listener, damit
   *  preventDefault greift und die Seite beim seitlichen Wischen nicht mitscrollt. */
  const asideRef = useRef<HTMLElement>(null)
  const [dragX, setDragX] = useState(0)
  useEffect(() => {
    const el = asideRef.current
    if (!el || !open) return
    let st: { x: number; y: number; t: number; horizontal: boolean | null; dx: number } | null = null
    const onStart = (e: TouchEvent) => { const t = e.touches[0]; st = { x: t.clientX, y: t.clientY, t: Date.now(), horizontal: null, dx: 0 } }
    const onMove = (e: TouchEvent) => {
      if (!st) return
      const t = e.touches[0]
      const dx = t.clientX - st.x, dy = t.clientY - st.y
      if (st.horizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        st.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
      }
      if (!st.horizontal) return
      e.preventDefault()
      st.dx = Math.max(0, dx)
      setDragX(st.dx)
    }
    const onEnd = () => {
      if (!st) return
      const { horizontal, dx, t } = st
      st = null
      setDragX(0)
      if (!horizontal) return
      if (dx > 90 || (dx > 40 && Date.now() - t < 300)) close()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** Solange die Schublade offen ist, scrollt die Seite dahinter nicht. */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const startNew = () => setEditing({ id: '', name: '', keys: [...pantry] })
  const toggleKey = (key: string) =>
    setEditing((e) => e && ({ ...e, keys: e.keys.includes(key) ? e.keys.filter((k) => k !== key) : [...e.keys, key] }))
  const save = () => {
    if (!editing || !editing.name.trim()) return
    onSaveSet({ ...editing, id: editing.id || slugId(editing.name), name: editing.name.trim() })
    setEditing(null)
  }

  return (
    <>
      {!open && (
        <button className="drawer-handle" onClick={onOpen} aria-label="Sets öffnen" title="Sets">
          <IconChevronLeft width={16} height={16} />
          <IconLayers width={18} height={18} />
        </button>
      )}
      {open && <div className="drawer-backdrop" onClick={close} />}
      <aside ref={asideRef} className={`drawer ${open ? 'open' : ''} ${dragX ? 'dragging' : ''}`} aria-hidden={!open} aria-label="Sets"
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}>
        {editing ? (
          <>
            <div className="drawer-head">
              <button className="backlink" onClick={() => setEditing(null)}><IconChevronLeft /> Sets</button>
              <button className="btn icon sm" onClick={close} aria-label="Schließen"><IconX width={18} height={18} /></button>
            </div>
            <div className="drawer-section">
              <span className="eyebrow">Name</span>
              <input className="input-sm" placeholder="z. B. Wochenende" value={editing.name} autoFocus={!editing.id}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') save() }} aria-label="Name des Sets" />
            </div>
            <div className="drawer-section">
              <span className="eyebrow">Zutaten · {editing.keys.length}</span>
              <div className="pantry-selected">
                {editing.keys.length === 0
                  ? <span className="hint">Noch leer. Unten Zutaten suchen oder aus dem Katalog wählen.</span>
                  : editing.keys.map((k) => (
                    <button key={k} className="chip sm" onClick={() => toggleKey(k)} aria-label={`${INGREDIENT_BY_KEY.get(k)?.name ?? k} entfernen`}>
                      {INGREDIENT_BY_KEY.get(k)?.name ?? k} <span className="x"><IconX width={14} height={14} /></span>
                    </button>
                  ))}
              </div>
            </div>
            <div className="drawer-section">
              <span className="eyebrow">Zutat hinzufügen</span>
              <IngredientPicker selected={new Set(editing.keys)} onToggle={toggleKey} diets={diets} />
            </div>
            <div className="drawer-foot">
              <button className="btn primary" onClick={save} disabled={!editing.name.trim()}>Speichern</button>
              <button className="btn" onClick={() => setEditing(null)}>Abbrechen</button>
            </div>
          </>
        ) : (
          <>
            <div className="drawer-head">
              <h2>Sets</h2>
              <button className="btn icon sm" onClick={close} aria-label="Schließen"><IconX width={18} height={18} /></button>
            </div>
            <p className="hint">Ein Set ist eine gespeicherte Zutatenliste. Laden fügt die Zutaten dem Vorrat hinzu.</p>
            <button className="btn primary" onClick={startNew}><IconPlus width={16} height={16} /> Neues Set{pantry.size > 0 ? ` aus dem Vorrat (${pantry.size})` : ''}</button>
            <div className="drawer-section">
              <span className="eyebrow">Gespeicherte Sets · {sets.length}</span>
              {sets.length === 0 ? <span className="hint">Noch keine Sets.</span> : (
                <ul className="set-list">
                  {sets.map((st) => {
                    const loaded = st.keys.length > 0 && st.keys.every((k) => pantry.has(k))
                    const names = st.keys.map((k) => INGREDIENT_BY_KEY.get(k)?.name ?? k)
                    return (
                      <li key={st.id} className={loaded ? 'loaded' : ''}>
                        <button className="set-main" onClick={() => setEditing({ ...st, keys: [...st.keys] })} title="Bearbeiten">
                          <b>{st.name}</b>
                          <small>{names.length === 0 ? 'leer' : names.slice(0, 5).join(', ') + (names.length > 5 ? ` +${names.length - 5}` : '')}</small>
                        </button>
                        <button className={`btn sm ${loaded ? '' : 'soft'}`} onClick={() => onApplySet(st)} disabled={loaded || st.keys.length === 0}>{loaded ? 'Geladen' : 'Laden'}</button>
                        <button className="btn icon sm ghost" onClick={() => onDeleteSet(st.id)} aria-label={`Set ${st.name} löschen`}><IconX width={16} height={16} /></button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {sets.length > 0 && <span className="hint">Tipp auf den Namen, um ein Set zu bearbeiten.</span>}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
