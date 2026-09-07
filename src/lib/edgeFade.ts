import { useEffect, type RefObject } from 'react'

/** Ab hier ist noch etwas außerhalb des Bildes – kleiner Puffer gegen Rundungsfehler. */
const RAND = 4

/**
 * Markiert eine waagerecht scrollende Reihe, solange links oder rechts noch etwas liegt.
 * Der Rand wird dann weich ausgeblendet: Ein mittendrin abgeschnittener Knopf sieht sonst
 * nach Fehler aus statt nach „hier geht es weiter“.
 */
export function useEdgeFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      el.classList.toggle('more-left', el.scrollLeft > RAND)
      el.classList.toggle('more-right', el.scrollLeft + el.clientWidth < el.scrollWidth - RAND)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // Breite ändert sich beim Drehen, der Inhalt beim Anlegen einer Liste.
    const groesse = new ResizeObserver(update)
    groesse.observe(el)
    const inhalt = new MutationObserver(update)
    inhalt.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      el.removeEventListener('scroll', update)
      groesse.disconnect()
      inhalt.disconnect()
    }
  }, [ref])
}
