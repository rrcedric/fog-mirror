import type { Point } from '../coords'

/** Vitesse lissée d'un point qui se déplace, en unités par seconde. */
export class SpeedMeter {
  private last: Point | null = null
  private lastTime = 0
  private speed = 0

  /** @param smoothing constante de temps du lissage, en secondes */
  constructor(private readonly smoothing = 0.08) {}

  /** `time` en secondes. */
  update(p: Point, time: number): number {
    if (this.last) {
      const dt = time - this.lastTime
      if (dt > 0) {
        const raw = Math.hypot(p.x - this.last.x, p.y - this.last.y) / dt
        this.speed += (raw - this.speed) * (1 - Math.exp(-dt / this.smoothing))
      }
    }
    this.last = { ...p }
    this.lastTime = time
    return this.speed
  }

  reset(): void {
    this.last = null
    this.speed = 0
  }
}
