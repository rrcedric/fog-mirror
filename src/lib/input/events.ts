import type { Point } from '../coords'

/** Souffle en cours, en coordonnées écran normalisées. `intensity` dans [0, 1]. */
export interface Breath extends Point {
  intensity: number
  /** Facteur appliqué au rayon de base de la nappe (1 par défaut). */
  scale?: number
}

/** Point d'une trace de doigt, en coordonnées écran normalisées. */
export interface StrokePoint extends Point {
  /** Vitesse du doigt en écrans par seconde (0 si inconnue) : un doigt rapide trace plus fin. */
  speed: number
}

/** Segment de trace de doigt. */
export interface Segment {
  a: StrokePoint
  b: StrokePoint
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
  private readonly lastPoints = new Map<string, StrokePoint>()
  private segments: Segment[] = []

  setBreath(source: string, breath: Breath | null): void {
    if (breath && breath.intensity > 0) this.breaths.set(source, breath)
    else this.breaths.delete(source)
  }

  strokeTo(source: string, point: Point & { speed?: number }): void {
    const next: StrokePoint = { x: point.x, y: point.y, speed: point.speed ?? 0 }
    const last = this.lastPoints.get(source) ?? next
    this.segments.push({ a: { ...last }, b: next })
    this.lastPoints.set(source, next)
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
