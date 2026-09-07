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
interface Options {
  /**
   * Das Element kennt einen eigenen Zustand für „zu“ – so wie eine Schublade, die ohne die Klasse
   * `open` ohnehin am rechten Rand steht. Dann wird sofort umgeschaltet, während das Element noch
   * hinausgleitet: Hintergrund und Griff reagieren im selben Moment und nicht erst am Ende.
   */
  closesItself?: boolean
}

export function useSwipeRight(ref: RefObject<HTMLElement | null>, enabled: boolean, onSwipe: () => void, { closesItself = false }: Options = {}) {
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

    /**
     * Schiebt ein Abbild der Seite aus dem Bild. Das Original wird beim Umschalten abgebaut,
     * das Abbild hängt frei über der Seite und trägt die Bewegung zu Ende.
     */
    const flyOut = (fromX: number) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = el.getBoundingClientRect()
      const copy = el.cloneNode(true) as HTMLElement
      copy.setAttribute('aria-hidden', 'true')
      // Ohne die Verschiebung gerechnet, damit das Abbild genau dort startet, wo das Original steht.
      copy.style.cssText = `position:fixed;left:${rect.left - fromX}px;top:${rect.top}px;width:${rect.width}px;`
        + `margin:0;pointer-events:none;z-index:15;transform:translate3d(${fromX}px,0,0);`
        + `transition:transform ${SNAP_MS}ms cubic-bezier(.22,.61,.36,1)`
      document.body.appendChild(copy)
      requestAnimationFrame(() => { copy.style.transform = `translate3d(${window.innerWidth}px,0,0)` })
      setTimeout(() => copy.remove(), SNAP_MS + 80)
    }

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
      if (closesItself) {
        // Eine Schublade steht ohne ihre Klasse `open` ohnehin am rechten Rand: sofort umschalten
        // und weitergleiten, dann reagieren Hintergrund und Griff im selben Moment.
        dx = el.getBoundingClientRect().width || window.innerWidth
        el.style.transform = `translate3d(${dx}px,0,0)`
        swipe.current()
        finish = setTimeout(() => {
          finish = undefined
          dx = 0
          requestAnimationFrame(() => { el.style.transform = '' })
        }, SNAP_MS)
        return
      }
      // Eine Seite verschwindet beim Umschalten. Damit man nicht auf einen leeren Hintergrund
      // schaut, während sie wegzieht, übernimmt eine Kopie die Bewegung – die neue Ansicht steht
      // dann schon darunter, statt am Ende hereinzuspringen.
      flyOut(dx)
      dx = 0
      el.style.transform = ''
      swipe.current()
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
  }, [ref, enabled, closesItself])
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
