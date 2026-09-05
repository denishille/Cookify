import { useEffect, type RefObject } from 'react'

/** Gemerkte Scrollpositionen je Ansicht, solange die App im Tab offen ist. */
const positions = new Map<string, number>()

/** Was gerade sichtbar ist: Schlüssel → aktuelle Position ablesen. */
const active = new Map<string, () => number>()

/** Ansichten, deren Position schon festgehalten wurde: spätere Scroll-Ereignisse zählen nicht mehr. */
const frozen = new Set<string>()

/** So lange wird nachgesteuert, bis die Liste ihre volle Höhe hat (Bilder, nachgeladene Kacheln). */
const SETTLE_MS = 800

/**
 * Hält alle sichtbaren Scrollpositionen fest, bevor die Ansicht wechselt.
 * Muss vor dem Routenwechsel laufen: beim Abbau springen Seite und Kachelreihen auf 0,
 * und wir würden uns diesen Wert merken statt der Stelle, an der man weggeklickt hat.
 */
export function freezeScroll() {
  for (const [key, read] of active) {
    positions.set(key, read())
    frozen.add(key)
  }
}

/**
 * Stellt die Scrollposition beim Wechsel zwischen Ansichten wieder her.
 * `ref` ist der Kasten, der scrollt – ohne `ref` die Seite selbst.
 * `achse` ist standardmäßig waagerecht für ein Element (z. B. eine Kachelreihe), senkrecht für die Seite.
 */
export function useScrollMemory(key: string, ref?: RefObject<HTMLElement | null>, achse: 'x' | 'y' = ref ? 'x' : 'y') {
  useEffect(() => {
    const el = ref ? ref.current : null
    if (ref && !el) return
    const read = () => (el ? (achse === 'x' ? el.scrollLeft : el.scrollTop) : window.scrollY)
    const write = (v: number) => {
      if (!el) return window.scrollTo(0, v)
      el.scrollTo(achse === 'x' ? { left: v } : { top: v })
    }

    frozen.delete(key)
    active.set(key, read)

    const saved = positions.get(key) ?? 0
    // Der Kasten bleibt beim Ansichtswechsel stehen, deshalb immer setzen – auch auf null.
    write(saved)
    let restoring = saved > 0

    // Solange die Ansicht noch wächst, würde ein einzelner Sprung zu kurz landen: bis zu 800 ms nachsteuern.
    if (restoring) {
      const until = Date.now() + SETTLE_MS
      const settle = () => {
        if (!restoring) return
        if (Math.abs(read() - saved) > 2) write(saved)
        if (Date.now() < until) requestAnimationFrame(settle)
        else restoring = false
      }
      requestAnimationFrame(settle)
    }

    const target: HTMLElement | Window = el ?? window
    const onScroll = () => { if (!restoring && !frozen.has(key)) positions.set(key, read()) }
    // Sobald von Hand gescrollt wird, hört das Nachsteuern sofort auf.
    const onUser = () => { restoring = false }
    target.addEventListener('scroll', onScroll, { passive: true })
    for (const ev of ['wheel', 'touchstart', 'keydown'] as const) target.addEventListener(ev, onUser, { passive: true })
    return () => {
      restoring = false
      active.delete(key)
      // Beim Aufräumen kann das Element schon abgehängt sein und läse dann 0 – dann gilt der letzte Wert.
      if (!frozen.has(key) && (!el || el.isConnected)) positions.set(key, read())
      target.removeEventListener('scroll', onScroll)
      for (const ev of ['wheel', 'touchstart', 'keydown'] as const) target.removeEventListener(ev, onUser)
    }
  }, [key, ref, achse])
}
