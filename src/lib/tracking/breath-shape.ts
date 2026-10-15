import type { ParamSpec } from '../param-spec'

/** Scores des blendshapes MediaPipe utiles pour reconnaître un souffle, dans [0, 1]. */
export interface MouthShape {
  jawOpen: number
  mouthFunnel: number
  mouthPucker: number
}

export interface BreathShapeParams {
  weightJawOpen: number
  weightFunnel: number
  weightPucker: number
  /** Le souffle démarre quand le score lissé dépasse ce seuil… */
  onThreshold: number
  /** …et s'arrête quand il repasse sous celui-ci (hystérésis). */
  offThreshold: number
  /** Score lissé pour lequel l'intensité atteint 1. */
  fullScore: number
  /** Constante de temps du lissage, en secondes. */
  smoothing: number
}

export const DEFAULT_BREATH_SHAPE_PARAMS: BreathShapeParams = {
  weightJawOpen: 1,
  weightFunnel: 1,
  weightPucker: 0.5,
  onThreshold: 0.35,
  offThreshold: 0.22,
  fullScore: 0.7,
  smoothing: 0.08,
}

export const BREATH_SHAPE_PARAM_SPECS: ParamSpec<BreathShapeParams>[] = [
  { folder: 'Visage', key: 'onThreshold', label: 'seuil départ', min: 0, max: 1, step: 0.01 },
  { folder: 'Visage', key: 'offThreshold', label: 'seuil arrêt', min: 0, max: 1, step: 0.01 },
  { folder: 'Visage', key: 'fullScore', label: 'score max', min: 0.1, max: 1.5, step: 0.01 },
  { folder: 'Visage', key: 'smoothing', label: 'lissage (s)', min: 0, max: 0.5, step: 0.01 },
  { folder: 'Visage', key: 'weightJawOpen', label: 'poids mâchoire', min: 0, max: 2, step: 0.05 },
  { folder: 'Visage', key: 'weightFunnel', label: 'poids « o »', min: 0, max: 2, step: 0.05 },
  { folder: 'Visage', key: 'weightPucker', label: 'poids moue', min: 0, max: 2, step: 0.05 },
]

/** Score brut de « forme de souffle » : bouche ouverte, arrondie (« o ») ou en moue. */
export function breathShapeScore(shape: MouthShape, p: BreathShapeParams): number {
  const score =
    p.weightJawOpen * shape.jawOpen +
    p.weightFunnel * shape.mouthFunnel +
    p.weightPucker * shape.mouthPucker
  return Math.min(Math.max(score, 0), 1.5)
}

export interface BreathShapeState {
  /** Score lissé. */
  score: number
  active: boolean
  /** Intensité du souffle dans [0, 1], nulle quand inactif. */
  intensity: number
}

/** Transforme une suite de formes de bouche en un état de souffle stable (lissage + hystérésis). */
export class BreathShapeDetector {
  private state: BreathShapeState = { score: 0, active: false, intensity: 0 }

  constructor(private readonly params: BreathShapeParams) {}

  /** `shape` vaut null quand aucun visage n'est détecté. `dt` en secondes. */
  update(shape: MouthShape | null, dt: number): BreathShapeState {
    const p = this.params
    if (!shape) {
      this.state = { score: 0, active: false, intensity: 0 }
      return this.state
    }
    const raw = breathShapeScore(shape, p)
    const alpha = p.smoothing > 0 ? 1 - Math.exp(-dt / p.smoothing) : 1
    const score = this.state.score + (raw - this.state.score) * alpha
    const active = this.state.active ? score >= p.offThreshold : score >= p.onThreshold
    const range = Math.max(p.fullScore - p.offThreshold, 1e-3)
    const intensity = active ? Math.min(Math.max((score - p.offThreshold) / range, 0), 1) : 0
    this.state = { score, active, intensity }
    return this.state
  }
}
