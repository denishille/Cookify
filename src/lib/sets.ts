/** Ein gespeichertes Zutaten-Set, z. B. „Grundvorrat“. */
export interface PantrySet {
  id: string
  name: string
  keys: string[]
}

/** Wird beim ersten Start angelegt. */
export const DEFAULT_SETS: PantrySet[] = [
  { id: 'default-grundvorrat', name: 'Grundvorrat', keys: ['salz', 'pfeffer'] },
]

export function slugId(name: string): string {
  return name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'set'
}
