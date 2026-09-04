import { useEffect, type RefObject } from 'react'

/** Gemerkte Scrollpositionen je Ansicht, solange die App im Tab offen ist. */
const positions = new Map<string, number>()

/**
 * Stellt die Scrollposition beim Wechsel zwischen Ansichten wieder her.
 * Ohne `ref` gilt es für die Seite (senkrecht), mit `ref` für das Element (waagerecht, z. B. eine Kachelreihe).
 */
export function useScrollMemory(key: string, ref?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref ? ref.current : null
    if (ref && !el) return
    const read = () => (el ? el.scrollLeft : window.scrollY)
    const write = (v: number) => (el ? el.scrollTo({ left: v }) : window.scrollTo(0, v))

    const saved = positions.get(key) ?? 0
    // Zwei Frames: nach dem Layout und noch einmal, wenn Bilder ihre Höhe gesetzt haben.
    requestAnimationFrame(() => { write(saved); requestAnimationFrame(() => write(saved)) })

    const target: HTMLElement | Window = el ?? window
    const onScroll = () => positions.set(key, read())
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      // Beim Aufräumen kann das Element schon abgehängt sein und läse dann 0 – dann gilt der letzte Wert.
      if (!el || el.isConnected) positions.set(key, read())
      target.removeEventListener('scroll', onScroll)
    }
  }, [key, ref])
}
