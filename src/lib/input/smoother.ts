import type { Point } from '../coords'

export interface SpeedPoint extends Point {
  speed: number
}

const mid = (a: SpeedPoint, b: SpeedPoint): SpeedPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  speed: (a.speed + b.speed) / 2,
})

/**
 * Transforme une suite de points bruts (une détection de la main tous les ~33 ms) en un tracé
 * courbe : on relie les milieux des segments successifs par des courbes de Bézier quadratiques
 * dont le point de contrôle est le point brut. Les angles deviennent des arrondis, au prix d'un
 * retard d'un demi-segment.
 */
export class StrokeSmoother {
  private points: SpeedPoint[] = []

  /** @param spacing distance maximale entre deux points émis, en unités écran */
  constructor(private readonly spacing = 0.004) {}

  /** Ajoute un point brut ; renvoie les points lissés à tracer. */
  push(p: SpeedPoint): SpeedPoint[] {
    this.points.push({ ...p })
    if (this.points.length > 3) this.points.shift()
    const [p0, p1, p2] = this.points
    if (this.points.length === 1) return [{ ...p0 }]
    if (this.points.length === 2) return this.line(p0, mid(p0, p1))
    return this.quad(mid(p0, p1), p1, mid(p1, p2))
  }

  /** Termine le tracé jusqu'au dernier point brut, puis repart de zéro. */
  end(): SpeedPoint[] {
    const n = this.points.length
    const out =
      n >= 2 ? this.line(mid(this.points[n - 2], this.points[n - 1]), this.points[n - 1]) : []
    this.points = []
    return out
  }

  private count(length: number): number {
    return Math.min(Math.max(Math.ceil(length / this.spacing), 1), 24)
  }

  /** Points de ]a, b], le départ ayant déjà été émis. */
  private line(a: SpeedPoint, b: SpeedPoint): SpeedPoint[] {
    const n = this.count(Math.hypot(b.x - a.x, b.y - a.y))
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        speed: a.speed + (b.speed - a.speed) * t,
      }
    })
  }

  /** Points de ]a, b] sur la courbe de Bézier quadratique a → c → b. */
  private quad(a: SpeedPoint, c: SpeedPoint, b: SpeedPoint): SpeedPoint[] {
    const length = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y)
    const n = this.count(length)
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n
      const u = 1 - t
      return {
        x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
        speed: a.speed + (b.speed - a.speed) * t,
      }
    })
  }
}
