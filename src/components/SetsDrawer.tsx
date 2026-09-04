import { useEffect, useState } from 'react'
import type { PantrySet } from '../lib/sets'
import { INGREDIENT_BY_KEY } from '../data'
import { IconChevronLeft, IconPlus, IconX } from './Icons'

interface Props {
  open: boolean
  onOpen: () => void
  onClose: () => void
  pantry: Set<string>
  sets: PantrySet[]
  onApplySet: (set: PantrySet) => void
  onSaveSet: (name: string) => void
  onDeleteSet: (id: string) => void
}

/** Griff am rechten Rand plus Schublade, die von rechts hereinfährt. */
export function SetsDrawer({ open, onOpen, onClose, pantry, sets, onApplySet, onSaveSet, onDeleteSet }: Props) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const save = () => {
    const n = name.trim()
    if (!n) return
    onSaveSet(n); setName('')
  }

  return (
    <>
      {!open && (
        <button className="drawer-handle" onClick={onOpen} aria-label="Sets öffnen" title="Sets">
          <IconChevronLeft width={18} height={18} />
        </button>
      )}
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Sets">
        <div className="drawer-head">
          <h2>Sets</h2>
          <button className="btn icon sm" onClick={onClose} aria-label="Schließen"><IconX width={18} height={18} /></button>
        </div>
        <p className="hint">Ein Set ist eine gespeicherte Zutatenliste. Laden fügt die Zutaten dem Vorrat hinzu.</p>

        <div className="drawer-section">
          <span className="eyebrow">Aktuellen Vorrat speichern</span>
          <div className="set-form">
            <input className="input-sm" placeholder="Name, z. B. Wochenende" value={name} disabled={pantry.size === 0}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} aria-label="Name des Sets" />
            <button className="btn sm primary" onClick={save} disabled={!name.trim() || pantry.size === 0}><IconPlus width={14} height={14} /> Speichern</button>
          </div>
          {pantry.size === 0 && <span className="hint">Erst Zutaten in den Vorrat legen.</span>}
        </div>

        <div className="drawer-section">
          <span className="eyebrow">Gespeicherte Sets · {sets.length}</span>
          {sets.length === 0 ? <span className="hint">Noch keine Sets.</span> : (
            <ul className="set-list">
              {sets.map((st) => {
                const loaded = st.keys.every((k) => pantry.has(k))
                const names = st.keys.map((k) => INGREDIENT_BY_KEY.get(k)?.name ?? k)
                return (
                  <li key={st.id} className={loaded ? 'loaded' : ''}>
                    <div className="set-main">
                      <b>{st.name}</b>
                      <small>{names.slice(0, 5).join(', ')}{names.length > 5 && ` +${names.length - 5}`}</small>
                    </div>
                    <button className={`btn sm ${loaded ? '' : 'soft'}`} onClick={() => onApplySet(st)} disabled={loaded}>{loaded ? 'Geladen' : 'Laden'}</button>
                    <button className="btn icon sm ghost" onClick={() => onDeleteSet(st.id)} aria-label={`Set ${st.name} löschen`}><IconX width={16} height={16} /></button>
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
