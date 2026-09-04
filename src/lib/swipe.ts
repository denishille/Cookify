import { useEffect, useState, type RefObject } from 'react'

/**
 * Wischen nach rechts löst `onSwipe` aus; das Element folgt dabei dem Finger (Rückgabewert in px).
 * Native Listener, damit `preventDefault` greift und die Seite beim seitlichen Wischen nicht mitscrollt.
 * Startpunkte ganz am linken Rand bleiben aus, damit der Zurück-Gestik des Browsers nichts dazwischenkommt.
 */
export function useSwipeRight(ref: RefObject<HTMLElement | null>, enabled: boolean, onSwipe: () => void): number {
  const [dragX, setDragX] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let st: { x: number; y: number; t: number; horizontal: boolean | null; dx: number } | null = null
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t.clientX < 30) return
      st = { x: t.clientX, y: t.clientY, t: Date.now(), horizontal: null, dx: 0 }
    }
    const onMove = (e: TouchEvent) => {
      if (!st) return
      const t = e.touches[0]
      const dx = t.clientX - st.x, dy = t.clientY - st.y
      if (st.horizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        st.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
      }
      if (!st.horizontal) return
      e.preventDefault()
      st.dx = Math.max(0, dx)
      setDragX(st.dx)
    }
    const onEnd = () => {
      if (!st) return
      const { horizontal, dx, t } = st
      st = null
      setDragX(0)
      if (!horizontal) return
      if (dx > 90 || (dx > 40 && Date.now() - t < 300)) onSwipe()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return dragX
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
