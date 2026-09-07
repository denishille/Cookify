import { useDeferredValue } from 'react'

/**
 * Zeigt beim Wechsel in eine Ansicht zuerst nur den Anfang einer langen Liste; den Rest
 * schiebt React gleich danach nach.
 *
 * Beim Zurückwischen aus einem Rezept muss die Zielansicht in einem Zug entstehen – jede
 * Kachel kostet Knoten, Bilder und Symbole, und so lange steht die Bewegung still. Was
 * ohnehin unter dem Bildrand liegt, darf einen Tick später kommen; zu sehen ist das nicht.
 *
 * Verkürzt wird nur beim Wechsel: Ändert sich die Liste danach noch (Herz, Filter), bleibt
 * sie vollständig – sonst spränge die Seite unter dem Finger weg.
 */
export function useProgressive<T>(items: T[], erste: number, schluessel: string): T[] {
  // Beim Wechsel hinkt der träge Wert einen Durchgang hinterher – genau dieser eine Durchgang
  // wird kurz gehalten, den nächsten rechnet React mit niedriger Dringlichkeit hinterher.
  const traege = useDeferredValue(schluessel)
  return traege !== schluessel && items.length > erste ? items.slice(0, erste) : items
}
