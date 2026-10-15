import type { Point } from '../coords'

/** Souffle en cours, en coordonnées écran normalisées. `intensity` dans [0, 1]. */
export interface Breath extends Point {
  intensity: number
  /** Facteur appliqué au rayon de base de la nappe (1 par défaut). */
  scale?: number
}

/** Segment de trace de doigt, en coordonnées écran normalisées. */
export interface Segment {
  a: Point
  b: Point
}

export interface FrameInput {
  breaths: Breath[]
  segments: Segment[]
}

/**
 * Point de rencontre entre les sources d'interaction (souris, visage, main…) et le moteur de buée.
 * Chaque source s'identifie par un nom ; le moteur ne sait pas d'où viennent les événements.
 *
 * - Un souffle est un état continu : il reste actif jusqu'à `setBreath(source, null)`.
 * - Une trace est une suite de points : chaque nouveau point produit un segment depuis le précédent.
 */
export class InputBus {
  private readonly breaths = new Map<string, Breath>()
  private readonly lastPoints = new Map<string, Point>()
  private segments: Segment[] = []

  setBreath(source: string, breath: Breath | null): void {
    if (breath && breath.intensity > 0) this.breaths.set(source, breath)
    else this.breaths.delete(source)
  }

  strokeTo(source: string, point: Point): void {
    const last = this.lastPoints.get(source) ?? point
    this.segments.push({ a: { ...last }, b: { ...point } })
    this.lastPoints.set(source, { ...point })
  }

  strokeEnd(source: string): void {
    this.lastPoints.delete(source)
  }

  /** Renvoie les souffles actifs et les segments accumulés depuis le dernier appel. */
  drain(): FrameInput {
    const segments = this.segments
    this.segments = []
    return { breaths: [...this.breaths.values()], segments }
  }
}
