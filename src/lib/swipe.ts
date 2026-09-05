import { useEffect, useRef, type RefObject } from 'react'

/** Wie lange das Zurückgleiten bzw. das Hinausschieben dauert. */
const SNAP_MS = 200

/**
 * Wischen nach rechts löst `onSwipe` aus; das Element folgt dabei dem Finger.
 *
 * Die Verschiebung läuft ausschließlich über `style.transform` am Element selbst – würde sie durch
 * React laufen, müsste bei jedem Finger-Millimeter die ganze Rezeptseite neu gerendert werden, und
 * genau das ruckelt. Losgelassen wird entweder zurückgefedert oder sauber hinausgeschoben.
 *
 * Native Listener, damit `preventDefault` greift und die Seite beim seitlichen Wischen nicht mitscrollt.
 * Startpunkte ganz am linken Rand bleiben aus, damit die Zurück-Geste des Browsers nichts dazwischenkommt.
 */
export function useSwipeRight(ref: RefObject<HTMLElement | null>, enabled: boolean, onSwipe: () => void) {
  // Die Geste wird einmal angemeldet; der Rückruf darf sich trotzdem bei jedem Rendern ändern.
  const swipe = useRef(onSwipe)
  useEffect(() => { swipe.current = onSwipe })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let start: { x: number; y: number; t: number; horizontal: boolean | null } | null = null
    let dx = 0
    let frame = 0
    let finish: ReturnType<typeof setTimeout> | undefined

    const paint = () => { frame = 0; el.style.transform = dx ? `translate3d(${dx}px,0,0)` : '' }
    const draw = () => { if (!frame) frame = requestAnimationFrame(paint) }

    /** Während der Geste kein Übergang, sonst hinkt das Element dem Finger hinterher. */
    const grab = () => { el.classList.add('dragging'); el.style.willChange = 'transform' }
    const release = () => { el.classList.remove('dragging'); el.style.willChange = '' }

    /** Liegt der Finger auf etwas, das selbst waagerecht scrollt (z. B. eine Kachelreihe)? */
    const onScroller = (target: EventTarget | null) => {
      let n = target instanceof Element ? target : null
      while (n && n !== el) {
        if (n.scrollWidth > n.clientWidth + 1) return true
        n = n.parentElement
      }
      return false
    }

    const onStart = (e: TouchEvent) => {
      if (finish) return
      const t = e.touches[0]
      if (t.clientX < 30 || onScroller(t.target)) return
      start = { x: t.clientX, y: t.clientY, t: Date.now(), horizontal: null }
      dx = 0
    }

    const onMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches[0]
      const mx = t.clientX - start.x, my = t.clientY - start.y
      if (start.horizontal === null) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
        start.horizontal = Math.abs(mx) > Math.abs(my) * 1.2
        if (start.horizontal) grab()
        else { start = null; return }
      }
      e.preventDefault()
      dx = Math.max(0, mx)
      draw()
    }

    const onEnd = () => {
      if (!start) return
      const { horizontal, t } = start
      start = null
      if (frame) { cancelAnimationFrame(frame); frame = 0 }
      if (!horizontal) return
      release()
      const commit = dx > 90 || (dx > 40 && Date.now() - t < 300)
      if (!commit) { dx = 0; el.style.transform = ''; return }
      // Erst zu Ende schieben, dann umschalten – ein Sprung mitten in der Bewegung fühlt sich falsch an.
      dx = el.getBoundingClientRect().width || window.innerWidth
      el.style.transform = `translate3d(${dx}px,0,0)`
      finish = setTimeout(() => {
        finish = undefined
        dx = 0
        // Erst umschalten, dann aufräumen: sonst steht die Schublade für ein Bild wieder mitten im Weg.
        swipe.current()
        requestAnimationFrame(() => { el.style.transform = '' })
      }, SNAP_MS)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (finish) clearTimeout(finish)
      release()
      el.style.transform = ''
      el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, enabled])
}

/** Sperrt das Scrollen der Seite, solange eine Schublade offen ist. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])
}
