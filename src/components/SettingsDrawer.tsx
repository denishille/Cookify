import { useEffect, useRef } from 'react'
import type { Diet } from '../types'
import { DIET_LABELS } from '../types'
import { IconCheck, IconX } from './Icons'
import { useScrollLock, useSwipeRight } from '../lib/swipe'

interface Props {
  open: boolean
  onClose: () => void
  globalDiets: Diet[]
  onChange: (next: Diet[]) => void
  adapt: boolean
  onAdaptChange: (next: boolean) => void
  strictFructose: boolean
  onStrictFructoseChange: (next: boolean) => void
}

/** Einstellungen: globale Ernährungsform, gilt auf allen Seiten und bleibt im Browser gespeichert. */
export function SettingsDrawer({ open, onClose, globalDiets, onChange, adapt, onAdaptChange, strictFructose, onStrictFructoseChange }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const asideRef = useRef<HTMLElement>(null)
  const dragX = useSwipeRight(asideRef, open, onClose)
  useScrollLock(open)

  const toggle = (d: Diet) => onChange(globalDiets.includes(d) ? globalDiets.filter((x) => x !== d) : [...globalDiets, d])

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside ref={asideRef} className={`drawer ${open ? 'open' : ''} ${dragX ? 'dragging' : ''}`} aria-hidden={!open} aria-label="Einstellungen"
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}>
        <div className="drawer-head">
          <h2>Einstellungen</h2>
          <button className="btn icon sm" onClick={onClose} aria-label="Schließen"><IconX width={18} height={18} /></button>
        </div>

        <div className="drawer-section">
          <span className="eyebrow">Meine Ernährungsform</span>
          <p className="hint">Gilt überall in der App. Mehrere Angaben müssen alle zutreffen.</p>
          <div className="settings-list" role="group" aria-label="Ernährungsform">
            {(Object.keys(DIET_LABELS) as Diet[]).filter((d) => d !== 'lowfodmap').map((d) => {
              const on = globalDiets.includes(d)
              return (
                <button key={d} className={`multi-item ${on ? 'on' : ''}`} onClick={() => toggle(d)} aria-pressed={on}>
                  <span className="box">{on && <IconCheck width={14} height={14} />}</span>{DIET_LABELS[d]}
                </button>
              )
            })}
          </div>
          {globalDiets.length > 0 && <button className="btn sm" onClick={() => onChange([])}>Keine Einschränkung</button>}
        </div>

        <div className="drawer-section">
          <span className="eyebrow">Rezepte anpassen</span>
          <div className="settings-list">
            <button className={`multi-item ${adapt ? 'on' : ''}`} onClick={() => onAdaptChange(!adapt)} aria-pressed={adapt}>
              <span className="box">{adapt && <IconCheck width={14} height={14} />}</span>Ersatz vorschlagen
            </button>
          </div>
          <p className="hint">An: Rezepte, bei denen nur wenige Zutaten nicht passen, zeigen wir mit Ersatz – etwa Zucker durch Traubenzucker oder Sahne durch Hafercreme. Aus: Du siehst nur Rezepte, die von sich aus passen.</p>
        </div>

        {globalDiets.includes('fruktosefrei') && (
          <div className="drawer-section">
            <span className="eyebrow">Fruchtzucker</span>
            <div className="settings-list">
              <button className={`multi-item ${strictFructose ? 'on' : ''}`} onClick={() => onStrictFructoseChange(!strictFructose)} aria-pressed={strictFructose}>
                <span className="box">{strictFructose && <IconCheck width={14} height={14} />}</span>Streng rechnen
              </button>
            </div>
            <p className="hint">
              Normal zählt der Fruchtzucker, der über den Traubenzucker hinausgeht – so viel wie der Körper schlecht aufnimmt.
              Eine Orange hat davon kaum etwas und darf bleiben, ein Apfel nicht. Streng zählt der gesamte Fruchtzucker,
              dann fällt auch die Orange raus. Erlaubt sind {strictFructose ? '0,8' : '2,5'} g je Portion.
            </p>
          </div>
        )}

        <p className="hint" style={{ marginTop: 'auto' }}>Wird auf diesem Gerät gespeichert, genau wie Favoriten, Vorrat und Sets.</p>
      </aside>
    </>
  )
}
