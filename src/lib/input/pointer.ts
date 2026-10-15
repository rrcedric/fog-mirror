import type { Point } from '../coords'
import type { InputBus } from './events'

const SOURCE = 'pointer'

/**
 * Contrôles souris provisoires (avant le suivi du visage et de la main) :
 * - clic gauche maintenu : souffle à la position du pointeur ;
 * - clic droit glissé, ou Maj + clic gauche glissé : trace de doigt.
 *
 * Renvoie une fonction qui retire les écouteurs.
 */
export function attachPointerInput(element: HTMLElement, bus: InputBus): () => void {
  let mode: 'breath' | 'stroke' | null = null
  let pointerId = -1

  const toPoint = (e: PointerEvent): Point => {
    const rect = element.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const apply = (e: PointerEvent) => {
    const p = toPoint(e)
    if (mode === 'breath') bus.setBreath(SOURCE, { ...p, intensity: 1 })
    else if (mode === 'stroke') bus.strokeTo(SOURCE, p)
  }

  const end = () => {
    if (mode === 'breath') bus.setBreath(SOURCE, null)
    if (mode === 'stroke') bus.strokeEnd(SOURCE)
    mode = null
    pointerId = -1
  }

  const onDown = (e: PointerEvent) => {
    if (mode) return
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) mode = 'stroke'
    else if (e.button === 0) mode = 'breath'
    else return
    pointerId = e.pointerId
    try {
      element.setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché ou synthétique : on continue sans capture.
    }
    apply(e)
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    // Les événements groupés donnent un tracé plus fluide qu'un seul point par frame.
    const events = e.getCoalescedEvents?.() ?? [e]
    for (const ev of events.length ? events : [e]) apply(ev)
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId === pointerId) end()
  }

  const onContextMenu = (e: Event) => e.preventDefault()

  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onUp)
  element.addEventListener('contextmenu', onContextMenu)

  return () => {
    end()
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointercancel', onUp)
    element.removeEventListener('contextmenu', onContextMenu)
  }
}
