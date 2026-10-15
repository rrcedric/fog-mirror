import type { Point } from '../coords'
import type { Breath, InputBus, Segment } from '../input/events'
import type { FogParams } from './params'

/** Nombre maximal de gouttes qui coulent en même temps (doit correspondre à composite.frag). */
export const MAX_DRIPS = 16
const SOURCE_PREFIX = 'drip:'

export type DripParams = Pick<
  FogParams,
  'dripRate' | 'dripSpeed' | 'dripWidth' | 'strokeRadius' | 'breathRadius'
>

/** Tête d'une goutte qui coule, en coordonnées écran ; `radius` en hauteurs d'écran. */
export interface DripHead extends Point {
  radius: number
}

interface Drip {
  id: number
  x: number
  y: number
  speed: number
  /** Distance déjà parcourue et distance totale avant que la goutte n'ait plus d'eau. */
  travel: number
  length: number
  /** Temps d'arrêt restant (la goutte avance par à-coups). */
  pause: number
  drift: number
  radius: number
}

interface Pending extends Point {
  at: number
}

/**
 * Gouttes qui coulent : l'eau repoussée par le doigt au bord d'un tracé, ou accumulée sous une
 * nappe de souffle prolongé, finit par former une goutte qui glisse vers le bas en laissant une
 * traînée nette (tracée dans le champ comme un trait fin, qui se ré-embue ensuite).
 *
 * Les gouttes avancent par à-coups, dérivent un peu sur les côtés et s'amincissent en perdant
 * leur eau.
 */
export class DripSystem {
  private drips: Drip[] = []
  private pending: Pending[] = []
  private nextId = 0
  private time = 0
  private strokeWater = 0

  constructor(
    private readonly params: DripParams,
    private readonly random: () => number = Math.random,
  ) {}

  /** Prend en compte les tracés et souffles de la frame pour faire naître des gouttes. */
  observe(segments: Segment[], breaths: Breath[], dt: number): void {
    const p = this.params
    if (p.dripRate <= 0) return
    for (const s of segments) {
      if (s.source.startsWith(SOURCE_PREFIX)) continue
      // L'eau repoussée s'accumule surtout sous les portions horizontales du tracé.
      const dx = Math.abs(s.b.x - s.a.x)
      const dy = Math.abs(s.b.y - s.a.y)
      this.strokeWater += (dx + 0.3 * dy) * p.dripRate
      if (this.strokeWater >= 1) {
        this.strokeWater -= 1 + this.random()
        // La goutte se forme sous le tracé, un peu plus tard.
        this.schedule(s.b.x, s.b.y + p.strokeRadius * 0.9, 0.4 + 2 * this.random())
      }
    }
    for (const b of breaths) {
      if (this.random() < 0.3 * p.dripRate * b.intensity * dt) {
        const r = p.breathRadius * (b.scale ?? 1)
        this.schedule(
          b.x + (this.random() - 0.5) * r,
          b.y + r * (0.5 + 0.3 * this.random()),
          1 + 2 * this.random(),
        )
      }
    }
  }

  /** Fait avancer les gouttes de `dt` secondes et trace leurs traînées dans le bus. */
  update(dt: number, bus: InputBus): void {
    this.time += dt
    const p = this.params
    for (const due of this.pending.filter((d) => d.at <= this.time)) {
      if (this.drips.length < MAX_DRIPS) this.spawn(due, bus)
    }
    this.pending = this.pending.filter((d) => d.at > this.time)

    for (const drip of this.drips) {
      if (drip.pause > 0) {
        drip.pause -= dt
        continue
      }
      // À-coups : la vitesse varie, et la goutte s'arrête parfois, le temps d'accumuler de l'eau.
      const target = p.dripSpeed * (0.5 + this.random())
      drip.speed += (target - drip.speed) * Math.min(1, dt * 4)
      if (this.random() < 0.7 * dt) drip.pause = 0.1 + 0.5 * this.random()
      const dy = drip.speed * dt
      drip.y += dy
      drip.travel += dy
      drip.drift += (this.random() - 0.5) * 0.6 * dt
      drip.drift *= 0.97
      drip.x += drip.drift * dy
      const water = 1 - drip.travel / drip.length
      bus.strokeTo(SOURCE_PREFIX + drip.id, {
        x: drip.x,
        y: drip.y,
        width: p.dripWidth * (0.55 + 0.45 * water),
      })
    }

    const done = this.drips.filter((d) => d.travel >= d.length || d.y > 1.05)
    for (const d of done) bus.strokeEnd(SOURCE_PREFIX + d.id)
    this.drips = this.drips.filter((d) => !done.includes(d))
  }

  heads(): DripHead[] {
    const p = this.params
    return this.drips.map((d) => ({
      x: d.x,
      y: d.y,
      radius: d.radius * p.strokeRadius * p.dripWidth * (0.6 + 0.4 * (1 - d.travel / d.length)),
    }))
  }

  get count(): number {
    return this.drips.length
  }

  clear(bus: InputBus): void {
    for (const d of this.drips) bus.strokeEnd(SOURCE_PREFIX + d.id)
    this.drips = []
    this.pending = []
    this.strokeWater = 0
  }

  private schedule(x: number, y: number, delay: number): void {
    if (y < 1) this.pending.push({ x, y, at: this.time + delay })
  }

  private spawn(at: Point, bus: InputBus): void {
    const drip: Drip = {
      id: this.nextId++,
      x: at.x,
      y: at.y,
      speed: 0,
      travel: 0,
      length: 0.08 + 0.35 * this.random(),
      pause: 0,
      drift: 0,
      radius: 1.1 + 0.5 * this.random(),
    }
    this.drips.push(drip)
    bus.strokeTo(SOURCE_PREFIX + drip.id, { x: drip.x, y: drip.y, width: this.params.dripWidth })
  }
}
