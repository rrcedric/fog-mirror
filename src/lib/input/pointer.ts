import type { Point } from '../coords'
import type { InputBus } from './events'
import { SpeedMeter } from './speed'

const SOURCE = 'pointer'

/**
 * Contrôles souris provisoires (avant le suivi du visage et de la main) :
 * - clic gauche maintenu : souffle à la position du pointeur ;
 * - clic droit glissé, ou Maj + clic gauche glissé : trace de doigt.
 *
 * Renvoie une fonction qui retire les écouteurs.
 */
export function attachPointerInput(
  element: HTMLElement,
  bus: InputBus,
  /** Signale un souffle terminé (durée en secondes) ou un bout de trait (longueur en écrans). */
  onActivity?: (kind: 'breath' | 'stroke', amount: number) => void,
): () => void {
  let mode: 'breath' | 'stroke' | null = null
  let pointerId = -1
  let breathStart = 0
  let last: Point | null = null
  const speed = new SpeedMeter()

  const toPoint = (e: PointerEvent): Point => {
    const rect = element.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const apply = (e: PointerEvent) => {
    const p = toPoint(e)
    if (mode === 'breath') bus.setBreath(SOURCE, { ...p, intensity: 1 })
    else if (mode === 'stroke') {
      bus.strokeTo(SOURCE, { ...p, speed: speed.update(p, e.timeStamp / 1000) })
      if (last) onActivity?.('stroke', Math.hypot(p.x - last.x, p.y - last.y))
      last = p
    }
  }

  const end = () => {
    if (mode === 'breath') {
      bus.setBreath(SOURCE, null)
      onActivity?.('breath', (performance.now() - breathStart) / 1000)
    }
    last = null
    if (mode === 'stroke') bus.strokeEnd(SOURCE)
    speed.reset()
    mode = null
    pointerId = -1
  }

  const onDown = (e: PointerEvent) => {
    if (mode) return
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) mode = 'stroke'
    else if (e.button === 0) mode = 'breath'
    else return
    pointerId = e.pointerId
    breathStart = performance.now()
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
