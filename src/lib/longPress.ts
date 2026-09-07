import { useEffect, useRef, type RefObject } from 'react'

/** So lange muss der Finger liegen bleiben, bis das Menü aufgeht. */
const HOLD_MS = 400
/** Bewegt er sich vorher weiter als das, wollte man scrollen. */
const SLOP = 10

interface Options {
  /** Wird mit der Kennung der gedrückten Karte und der Stelle auf dem Bildschirm gerufen. */
  onHold: (recipeId: string, x: number, y: number) => void
  enabled?: boolean
}

/**
 * Auf eine Rezeptkarte drücken und halten. Karten tragen `data-recipe-id`.
 *
 * Ein Zuhörer am Umschlag statt an jeder Karte, damit lange Listen nichts kosten.
 * Nach dem Halten wird der folgende Klick geschluckt – sonst öffnete sich zusätzlich das Rezept.
 */
export function useLongPress(containerRef: RefObject<HTMLElement | null>, { onHold, enabled = true }: Options) {
  const hold = useRef(onHold)
  useEffect(() => { hold.current = onHold })

  useEffect(() => {
    const root = containerRef.current
    if (!root || !enabled) return

    let card: HTMLElement | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let startX = 0, startY = 0
    let fired = false

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = undefined }
      card?.classList.remove('pressing')
      card = null
    }

    /**
     * Nach dem Halten darf sich die Karte nicht auch noch öffnen – aber nur der Klick auf die
     * Karte selbst wird geschluckt. Der Tipp ins Menü, das gerade aufgegangen ist, muss durch.
     */
    const swallowClick = () => {
      const eat = (e: Event) => {
        if (!(e.target instanceof Element) || !root.contains(e.target)) return
        e.stopPropagation(); e.preventDefault()
      }
      window.addEventListener('click', eat, { capture: true })
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 500)
    }

    const arm = (target: EventTarget | null, x: number, y: number) => {
      const found = target instanceof Element ? (target.closest('[data-recipe-id]') as HTMLElement | null) : null
      // Herz und Daumen auf der Karte machen etwas anderes.
      if (!found || (target instanceof Element && target.closest('button'))) return
      card = found
      startX = x; startY = y
      fired = false
      card.classList.add('pressing')
      timer = setTimeout(() => {
        const el = card
        if (!el) return
        fired = true
        const id = el.dataset.recipeId
        el.classList.remove('pressing')
        const r = el.getBoundingClientRect()
        card = null
        timer = undefined
        if (id) hold.current(id, r.left + r.width / 2, r.top + Math.min(r.height / 2, 90))
      }, HOLD_MS)
    }

    const moved = (x: number, y: number) => {
      if (!card) return
      if (Math.abs(x - startX) > SLOP || Math.abs(y - startY) > SLOP) cancel()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      arm(t.target, t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; moved(t.clientX, t.clientY) }
    const onTouchEnd = () => { cancel(); if (fired) { fired = false; swallowClick() } }

    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) arm(e.target, e.clientX, e.clientY) }
    const onMouseMove = (e: MouseEvent) => moved(e.clientX, e.clientY)
    const onMouseUp = onTouchEnd

    /** Rechtsklick und das Menü des Browsers führen zum selben Ziel. */
    const onContextMenu = (e: MouseEvent) => {
      const found = e.target instanceof Element ? (e.target.closest('[data-recipe-id]') as HTMLElement | null) : null
      if (!found) return
      e.preventDefault()
      cancel()
      const id = found.dataset.recipeId
      if (id) hold.current(id, e.clientX, e.clientY)
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: true })
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener('touchcancel', cancel)
    root.addEventListener('mousedown', onMouseDown)
    root.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('scroll', cancel, true)
    return () => {
      cancel()
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', cancel)
      root.removeEventListener('mousedown', onMouseDown)
      root.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('scroll', cancel, true)
    }
  }, [containerRef, enabled])
}
