export interface Color {
  r: number
  g: number
  b: number
}

/**
 * Paramètres du moteur de buée. Les distances sont exprimées en fraction de la hauteur de l'écran,
 * les taux en unités de densité par seconde (la densité va de 0, miroir net, à 1, buée opaque).
 */
export interface FogParams {
  /** Résolution du champ de densité par rapport au canvas. */
  fieldScale: number
  breathRadius: number
  breathRate: number
  strokeRadius: number
  /** Part de la buée retirée au centre du trait (1 = miroir parfaitement net). */
  strokeStrength: number
  /** Évaporation proportionnelle à la densité (par seconde). */
  evaporation: number
  /** Évaporation constante (par seconde), pour que la buée finisse par disparaître. */
  evaporationFloor: number
  /** Irrégularité spatiale de l'évaporation (0 = uniforme). */
  evaporationVariation: number
  diffusion: number
  blurRadius: number
  veilOpacity: number
  fogColor: Color
}

export const DEFAULT_PARAMS: FogParams = {
  fieldScale: 0.5,
  breathRadius: 0.14,
  breathRate: 2.2,
  strokeRadius: 0.022,
  strokeStrength: 0.95,
  evaporation: 0.06,
  evaporationFloor: 0.012,
  evaporationVariation: 0.6,
  diffusion: 0.6,
  blurRadius: 0.035,
  veilOpacity: 0.55,
  fogColor: { r: 0.86, g: 0.9, b: 0.92 },
}

export function createParams(): FogParams {
  return structuredClone(DEFAULT_PARAMS)
}

export function resetParams(params: FogParams): void {
  Object.assign(params, structuredClone(DEFAULT_PARAMS))
}

type NumericKey = {
  [K in keyof FogParams]: FogParams[K] extends number ? K : never
}[keyof FogParams]

export interface ParamSpec {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  folder: 'Souffle' | 'Doigt' | 'Évaporation' | 'Rendu'
}

/** Description des réglages exposés dans le panneau de développement. */
export const PARAM_SPECS: ParamSpec[] = [
  { folder: 'Souffle', key: 'breathRadius', label: 'rayon', min: 0.02, max: 0.4, step: 0.005 },
  { folder: 'Souffle', key: 'breathRate', label: 'débit', min: 0.1, max: 8, step: 0.1 },
  { folder: 'Doigt', key: 'strokeRadius', label: 'épaisseur', min: 0.005, max: 0.08, step: 0.001 },
  { folder: 'Doigt', key: 'strokeStrength', label: 'netteté', min: 0, max: 1, step: 0.01 },
  {
    folder: 'Évaporation',
    key: 'evaporation',
    label: 'proportionnelle',
    min: 0,
    max: 0.5,
    step: 0.005,
  },
  {
    folder: 'Évaporation',
    key: 'evaporationFloor',
    label: 'constante',
    min: 0,
    max: 0.1,
    step: 0.001,
  },
  {
    folder: 'Évaporation',
    key: 'evaporationVariation',
    label: 'irrégularité',
    min: 0,
    max: 1,
    step: 0.01,
  },
  { folder: 'Évaporation', key: 'diffusion', label: 'diffusion', min: 0, max: 5, step: 0.05 },
  {
    folder: 'Rendu',
    key: 'fieldScale',
    label: 'résolution champ',
    min: 0.125,
    max: 1,
    step: 0.125,
  },
  { folder: 'Rendu', key: 'blurRadius', label: 'flou', min: 0, max: 0.1, step: 0.001 },
  { folder: 'Rendu', key: 'veilOpacity', label: 'voile', min: 0, max: 1, step: 0.01 },
]
