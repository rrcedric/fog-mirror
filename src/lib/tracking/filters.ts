import type { Point } from '../coords'
import type { ParamSpec } from '../param-spec'

/**
 * Filtre « One Euro » (Casiez et al., 2012) : lisse fortement un signal lent (supprime le
 * tremblement) et peu un signal rapide (pas de retard quand on bouge vite).
 */
export interface OneEuroParams {
  /** Fréquence de coupure au repos, en Hz : plus bas = plus lisse. */
  minCutoff: number
  /** Augmentation de la coupure avec la vitesse : plus haut = moins de retard en mouvement. */
  beta: number
  /** Fréquence de coupure du lissage de la vitesse, en Hz. */
  dCutoff: number
}

export const DEFAULT_ONE_EURO_PARAMS: OneEuroParams = { minCutoff: 1.5, beta: 8, dCutoff: 1 }

export const ONE_EURO_PARAM_SPECS: ParamSpec<OneEuroParams>[] = [
  { folder: 'Main', key: 'minCutoff', label: 'lissage repos (Hz)', min: 0.1, max: 10, step: 0.1 },
  { folder: 'Main', key: 'beta', label: 'réactivité', min: 0, max: 50, step: 0.5 },
]

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))

export class OneEuroFilter {
  private value: number | null = null
  private derivative = 0
  private lastTime = 0

  constructor(private readonly params: OneEuroParams) {}

  /** `time` en secondes. */
  filter(value: number, time: number): number {
    if (this.value === null) {
      this.value = value
      this.lastTime = time
      return value
    }
    const dt = time - this.lastTime
    if (dt <= 0) return this.value
    this.lastTime = time
    const p = this.params
    const rawDerivative = (value - this.value) / dt
    this.derivative += alpha(p.dCutoff, dt) * (rawDerivative - this.derivative)
    const cutoff = p.minCutoff + p.beta * Math.abs(this.derivative)
    this.value += alpha(cutoff, dt) * (value - this.value)
    return this.value
  }

  reset(): void {
    this.value = null
    this.derivative = 0
  }
}

export class OneEuroFilter2D {
  private readonly x: OneEuroFilter
  private readonly y: OneEuroFilter

  constructor(params: OneEuroParams) {
    this.x = new OneEuroFilter(params)
    this.y = new OneEuroFilter(params)
  }

  filter(p: Point, time: number): Point {
    return { x: this.x.filter(p.x, time), y: this.y.filter(p.y, time) }
  }

  reset(): void {
    this.x.reset()
    this.y.reset()
  }
}
