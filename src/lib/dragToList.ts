import { useEffect, useRef, type RefObject } from 'react'

/** So lange muss ein Finger liegen bleiben, bevor aus dem Tippen ein Ziehen wird. */
const HOLD_MS = 280
/** Bewegt sich der Finger vorher weiter als das, war es Scrollen und kein Ziehen. */
const SLOP = 10

interface Options {
  /** Wo darf gezogen werden? Karten tragen `data-recipe-id`, Ziele `data-drop-list`. */
  onDrop: (recipeId: string, listId: string) => void
  enabled?: boolean
}

/**
 * Rezeptkarten mit dem Finger auf eine Liste ziehen.
 *
 * Mit Zeigerereignissen statt der Drag-and-Drop-Schnittstelle des Browsers: die gibt es auf
 * iOS nicht. Auf dem Handy fängt das Ziehen erst nach kurzem Halten an, sonst könnte man die
 * Seite nicht mehr scrollen; mit der Maus reicht das Ziehen selbst.
 */
export function useDragToList(containerRef: RefObject<HTMLElement | null>, { onDrop, enabled = true }: Options) {
  const drop = useRef(onDrop)
  useEffect(() => { drop.current = onDrop })

  useEffect(() => {
    const root = containerRef.current
    if (!root || !enabled) return

    let card: HTMLElement | null = null
    let ghost: HTMLElement | null = null
    let target: HTMLElement | null = null
    let hold: ReturnType<typeof setTimeout> | undefined
    let startX = 0, startY = 0
    let dragging = false
    let frame = 0
    let lastX = 0, lastY = 0

    const clearHold = () => { if (hold) { clearTimeout(hold); hold = undefined } }

    const highlight = (next: HTMLElement | null) => {
      if (next === target) return
      target?.classList.remove('drop-over')
      target = next
      target?.classList.add('drop-over')
    }

    const paint = () => {
      frame = 0
      // Das Schildchen schwebt über dem Finger, sonst verdeckt es genau das Ziel.
      if (ghost) ghost.style.transform = `translate3d(${lastX}px,${lastY}px,0) translate(-50%,-170%)`
      const under = document.elementFromPoint(lastX, lastY)
      highlight(under instanceof Element ? (under.closest('[data-drop-list]') as HTMLElement | null) : null)
    }

    const begin = () => {
      if (!card) return
      dragging = true
      card.classList.add('dragging-card')
      ghost = document.createElement('div')
      ghost.className = 'drag-ghost'
      ghost.textContent = card.querySelector('.card-title')?.textContent ?? 'Rezept'
      document.body.appendChild(ghost)
      document.body.classList.add('dragging-anything')
      paint()
    }

    const stop = (dropped: boolean) => {
      clearHold()
      if (frame) { cancelAnimationFrame(frame); frame = 0 }
      const id = card?.dataset.recipeId
      const listId = target?.dataset.dropList
      card?.classList.remove('dragging-card')
      ghost?.remove()
      highlight(null)
      document.body.classList.remove('dragging-anything')
      const wasDragging = dragging
      card = null; ghost = null; dragging = false
      if (dropped && wasDragging && id && listId) drop.current(id, listId)
      return wasDragging
    }

    // --- Finger ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const found = t.target instanceof Element ? (t.target.closest('[data-recipe-id]') as HTMLElement | null) : null
      // Das Herz und der Daumen auf der Karte machen etwas anderes.
      if (!found || (t.target instanceof Element && t.target.closest('button'))) return
      card = found
      startX = lastX = t.clientX; startY = lastY = t.clientY
      hold = setTimeout(begin, HOLD_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!card) return
      const t = e.touches[0]
      lastX = t.clientX; lastY = t.clientY
      if (!dragging) {
        if (Math.abs(lastX - startX) > SLOP || Math.abs(lastY - startY) > SLOP) { clearHold(); card = null }
        return
      }
      e.preventDefault()
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const onTouchEnd = () => { if (stop(true)) suppressClick() }
    const onTouchCancel = () => { stop(false) }

    // --- Maus ---
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const found = e.target instanceof Element ? (e.target.closest('[data-recipe-id]') as HTMLElement | null) : null
      if (!found || (e.target instanceof Element && e.target.closest('button'))) return
      // Ohne das zieht der Browser stattdessen das Bild aus der Karte heraus.
      e.preventDefault()
      card = found
      startX = lastX = e.clientX; startY = lastY = e.clientY
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!card) return
      lastX = e.clientX; lastY = e.clientY
      if (!dragging && (Math.abs(lastX - startX) > SLOP || Math.abs(lastY - startY) > SLOP)) begin()
      if (dragging) { e.preventDefault(); if (!frame) frame = requestAnimationFrame(paint) }
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (stop(true)) suppressClick()
    }

    /** Nach dem Ziehen darf die Karte sich nicht auch noch öffnen. */
    const suppressClick = () => {
      const eat = (e: Event) => { e.stopPropagation(); e.preventDefault() }
      window.addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 400)
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener('touchcancel', onTouchCancel)
    root.addEventListener('mousedown', onMouseDown)
    return () => {
      stop(false)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchCancel)
      root.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerRef, enabled])
}
