import { INGREDIENT_BY_KEY } from '../data'
import { IngredientPicker } from './IngredientPicker'
import { IconX } from './Icons'

interface Props {
  pantry: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
}

export function PantryPicker({ pantry, onToggle, onClear }: Props) {
  const selected = [...pantry].map((k) => INGREDIENT_BY_KEY.get(k)).filter((i) => i !== undefined)

  return (
    <div className="panel">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Zutat hinzufügen</div>
        <IngredientPicker selected={pantry} onToggle={onToggle} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="eyebrow">Im Vorrat · {selected.length}</span>
          {selected.length > 0 && <button className="btn sm" onClick={onClear}>Alles entfernen</button>}
        </div>
        <div className="pantry-selected">
          {selected.length === 0
            ? <span className="hint">Noch leer. Such oben eine Zutat und füge sie hinzu.</span>
            : selected.map((i) => (
              <button key={i.key} className="chip sm" onClick={() => onToggle(i.key)} aria-label={`${i.name} entfernen`}>
                {i.name} <span className="x"><IconX width={14} height={14} /></span>
              </button>
            ))}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Salz, Pfeffer, Öl und Gewürze setzen wir bei der Suche voraus.</p>
      </div>
    </div>
  )
}
