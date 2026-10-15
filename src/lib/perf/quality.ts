import type { Quality } from '../fog/engine'

/** Niveaux de qualité, du meilleur au plus léger. */
export const QUALITY_LEVELS: readonly Quality[] = [
  { pixelRatio: 2, fieldScale: 1 },
  { pixelRatio: 1.5, fieldScale: 1 },
  { pixelRatio: 1.25, fieldScale: 0.75 },
  { pixelRatio: 1, fieldScale: 0.5 },
]

export interface QualityParams {
  /** En dessous de cette fréquence d'affichage, on baisse la qualité… */
  lowFps: number
  /** …si elle y reste pendant ce temps, en secondes. */
  lowTime: number
  /** Au-dessus de cette fréquence, on remonte la qualité… */
  highFps: number
  /** …si elle y reste pendant ce temps (plus long, pour ne pas osciller). */
  highTime: number
}

export const DEFAULT_QUALITY_PARAMS: QualityParams = {
  lowFps: 45,
  lowTime: 2,
  highFps: 57,
  highTime: 20,
}

/**
 * Qualité adaptative : baisse la qualité quand l'affichage n'est plus fluide, et la remonte
 * prudemment quand il l'est à nouveau depuis longtemps.
 */
export class QualityGovernor {
  private lowFor = 0
  private highFor = 0
  level = 0

  constructor(private readonly params: QualityParams = DEFAULT_QUALITY_PARAMS) {}

  get quality(): Quality {
    return QUALITY_LEVELS[this.level]
  }

  /**
   * À appeler régulièrement avec la fréquence mesurée et le temps écoulé (secondes).
   * Renvoie la nouvelle qualité quand elle change, sinon null.
   */
  update(fps: number, dt: number): Quality | null {
    const p = this.params
    this.lowFor = fps < p.lowFps ? this.lowFor + dt : 0
    this.highFor = fps >= p.highFps ? this.highFor + dt : 0
    if (this.lowFor >= p.lowTime && this.level < QUALITY_LEVELS.length - 1) {
      this.level++
    } else if (this.highFor >= p.highTime && this.level > 0) {
      this.level--
    } else {
      return null
    }
    this.lowFor = 0
    this.highFor = 0
    return this.quality
  }
}
