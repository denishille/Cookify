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
     * Legt ein Standbild der Seite über die Seite und versteckt das Original.
     *
     * Danach kann die Zielseite in Ruhe aufgebaut werden: Der Nutzer sieht so lange das
     * Standbild und damit dasselbe Bild wie vorher – kein weißes Loch, kein Doppelbild.
     * Erst wenn die neue Ansicht steht, zieht das Standbild zur Seite und gibt sie frei.
     *
     * Die Hülle ist genau fensergroß und beschneidet die Kopie: Eine Rezeptseite ist ein
     * Vielfaches höher als der Bildschirm, und ohne Beschnitt malt der Browser sie komplett.
     */
    const freeze = (fromX: number) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
      const rect = el.getBoundingClientRect()
      const huelle = document.createElement('div')
      huelle.setAttribute('aria-hidden', 'true')
      huelle.style.cssText = 'position:fixed;inset:0;z-index:15;overflow:hidden;pointer-events:none;'
        + 'contain:layout paint;will-change:transform;'
        + `transform:translate3d(${fromX}px,0,0);transition:transform ${SNAP_MS}ms cubic-bezier(.22,.61,.36,1)`
      const copy = el.cloneNode(true) as HTMLElement
      // Ohne die Verschiebung gerechnet, damit die Kopie genau dort steht, wo das Original stand.
      copy.style.cssText = `position:absolute;left:${rect.left - fromX}px;top:${rect.top}px;width:${rect.width}px;margin:0;transform:none`
      huelle.appendChild(copy)
      document.body.appendChild(huelle)
      el.style.visibility = 'hidden'
      let weg = false
      const abraeumen = () => {
        if (weg) return
        weg = true
        huelle.remove()
        el.style.visibility = ''
      }
      return {
        /** Zur Seite ziehen und die neue Ansicht freigeben. */
        raus: () => {
          huelle.style.transform = `translate3d(${window.innerWidth}px,0,0)`
          setTimeout(abraeumen, SNAP_MS + 80)
        },
        abraeumen,
      }
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
      // Eine Seite verschwindet beim Umschalten. Damit dabei nichts blitzt, hält ein Standbild
      // die alte Ansicht fest, während die neue aufgebaut wird, und zieht erst dann zur Seite.
      const standbild = freeze(dx)
      dx = 0
      el.style.transform = ''
      if (!standbild) { swipe.current(); return }
      const parent = el.parentElement
      swipe.current()
      // Erst wenn die neue Ansicht wirklich steht, zieht das Standbild zur Seite – sonst schaut
      // man dahinter ins Leere. Fertig ist sie, sobald React die alte Seite aus dem Baum nimmt;
      // die Umschaltung läuft über die Adresszeile und kommt darum nicht im selben Zug an.
      let gestartet = false
      const los = () => {
        if (gestartet) return
        gestartet = true
        beobachter.disconnect()
        clearTimeout(notbremse)
        requestAnimationFrame(() => standbild.raus())
      }
      const beobachter = new MutationObserver(() => { if (!el.isConnected) los() })
      if (parent) beobachter.observe(parent, { childList: true })
      // Falls die Seite ausnahmsweise stehen bleibt, wartet das Standbild nicht endlos.
      const notbremse = setTimeout(los, 260)
      if (!el.isConnected) los()
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
      el.style.visibility = ''
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
