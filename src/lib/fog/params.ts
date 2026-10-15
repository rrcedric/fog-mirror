import type { ParamSpec } from '../param-spec'

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
  /**
   * Étalement de la nappe : 1 = profil gaussien (la buée se concentre au centre et gagne les bords
   * lentement), plus grand = profil plus plat (les bords se remplissent presque aussi vite).
   */
  breathSpread: number
  /** Déformation organique de la nappe de souffle (0 = forme ronde). */
  breathWarp: number
  strokeRadius: number
  /** Part de la buée retirée au centre du trait (1 = miroir parfaitement net). */
  strokeStrength: number
  /** Irrégularité du bord du trait (0 = bord parfaitement lisse). */
  strokeEdgeNoise: number
  /** Buée laissée en fines stries dans le trait (0 = essuyage net). */
  strokeStreaks: number
  /** Buée repoussée en bourrelet sur les bords du trait quand le doigt avance. */
  strokeRim: number
  /** Amincissement du trait quand le doigt va vite (0 = largeur constante). */
  strokeThinning: number
  /** Temps caractéristique de la re-condensation d'un tracé, en secondes. */
  refogTime: number
  /** Part de la buée qui se reforme sur un tracé (0 = le tracé reste net, 1 = il disparaît). */
  refogAmount: number
  /** Gouttes formées par hauteur d'écran de tracé (0 = pas de gouttes qui coulent). */
  dripRate: number
  /** Vitesse moyenne d'une goutte qui coule, en hauteurs d'écran par seconde. */
  dripSpeed: number
  /** Largeur de la traînée d'une goutte, en fraction de l'épaisseur du trait. */
  dripWidth: number
  /** Évaporation proportionnelle à la densité (par seconde). */
  evaporation: number
  /** Évaporation constante (par seconde), pour que la buée finisse par disparaître. */
  evaporationFloor: number
  /** Irrégularité spatiale de l'évaporation (0 = uniforme). */
  evaporationVariation: number
  diffusion: number
  /** Étalement du flou (pyramide dual Kawase) : 1 = standard. */
  blurSpread: number
  veilOpacity: number
  fogColor: Color
  /** Part du voile qui dépend de la luminosité de la scène (la buée diffuse la lumière reçue). */
  veilScatter: number
  /** Grain très fin du voile (les microgouttelettes). */
  grain: number
  /** Variations lentes de l'intensité du voile, fixes sur la vitre. */
  mottling: number
  /** Quantité de gouttes posées sur la vitre là où la buée est épaisse (0 = aucune). */
  droplets: number
  /** Nombre de cellules de gouttes par hauteur d'écran : plus = gouttes plus petites. */
  dropletScale: number
  /** Relief et reflets de la pellicule d'eau là où son épaisseur varie (bords des traces). */
  wetEdge: number
  /** Déviation de l'image par l'eau et les gouttes. */
  refraction: number
}

export const DEFAULT_PARAMS: FogParams = {
  fieldScale: 0.5,
  breathRadius: 0.24,
  breathRate: 3,
  breathSpread: 2,
  breathWarp: 0.8,
  strokeRadius: 0.035,
  strokeStrength: 0.95,
  strokeEdgeNoise: 0.45,
  strokeStreaks: 0.35,
  strokeRim: 0.3,
  strokeThinning: 0.35,
  refogTime: 6,
  refogAmount: 0.7,
  dripRate: 2.5,
  dripSpeed: 0.08,
  dripWidth: 0.18,
  evaporation: 0.06,
  evaporationFloor: 0.012,
  evaporationVariation: 0.6,
  diffusion: 1,
  blurSpread: 1.2,
  veilOpacity: 0.55,
  fogColor: { r: 0.86, g: 0.9, b: 0.92 },
  veilScatter: 0.6,
  grain: 0.5,
  mottling: 0.35,
  droplets: 0.06,
  dropletScale: 45,
  wetEdge: 0.6,
  refraction: 0.6,
}

export function createParams(): FogParams {
  return structuredClone(DEFAULT_PARAMS)
}

export function resetParams(params: FogParams): void {
  Object.assign(params, structuredClone(DEFAULT_PARAMS))
}

/** Description des réglages exposés dans le panneau de développement. */
export const FOG_PARAM_SPECS: ParamSpec<FogParams>[] = [
  { folder: 'Souffle', key: 'breathRadius', label: 'rayon', min: 0.02, max: 0.4, step: 0.005 },
  { folder: 'Souffle', key: 'breathRate', label: 'débit', min: 0.1, max: 8, step: 0.1 },
  { folder: 'Souffle', key: 'breathSpread', label: 'étalement', min: 1, max: 4, step: 0.1 },
  { folder: 'Souffle', key: 'breathWarp', label: 'forme organique', min: 0, max: 1.5, step: 0.01 },
  { folder: 'Doigt', key: 'strokeRadius', label: 'épaisseur', min: 0.005, max: 0.08, step: 0.001 },
  { folder: 'Doigt', key: 'strokeStrength', label: 'netteté', min: 0, max: 1, step: 0.01 },
  { folder: 'Doigt', key: 'strokeEdgeNoise', label: 'bord irrégulier', min: 0, max: 1, step: 0.01 },
  { folder: 'Doigt', key: 'strokeStreaks', label: 'stries', min: 0, max: 1, step: 0.01 },
  { folder: 'Doigt', key: 'strokeRim', label: 'bourrelet', min: 0, max: 1, step: 0.01 },
  {
    folder: 'Doigt',
    key: 'strokeThinning',
    label: 'finesse si rapide',
    min: 0,
    max: 0.8,
    step: 0.01,
  },
  { folder: 'Doigt', key: 'refogTime', label: 'ré-embuage (s)', min: 0.5, max: 60, step: 0.5 },
  { folder: 'Doigt', key: 'refogAmount', label: 'part ré-embuée', min: 0, max: 1, step: 0.01 },
  { folder: 'Gouttes', key: 'dripRate', label: 'fréquence', min: 0, max: 15, step: 0.1 },
  { folder: 'Gouttes', key: 'dripSpeed', label: 'vitesse', min: 0.01, max: 0.4, step: 0.005 },
  { folder: 'Gouttes', key: 'dripWidth', label: 'largeur traînée', min: 0.1, max: 0.8, step: 0.01 },
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
  { folder: 'Rendu', key: 'blurSpread', label: 'flou', min: 0.2, max: 3, step: 0.05 },
  { folder: 'Rendu', key: 'veilOpacity', label: 'voile', min: 0, max: 1, step: 0.01 },
  { folder: 'Rendu', key: 'veilScatter', label: 'diffusion lumière', min: 0, max: 1, step: 0.01 },
  { folder: 'Rendu', key: 'grain', label: 'grain', min: 0, max: 1, step: 0.01 },
  { folder: 'Rendu', key: 'mottling', label: 'variations voile', min: 0, max: 1, step: 0.01 },
  { folder: 'Gouttes', key: 'droplets', label: 'gouttes posées', min: 0, max: 1, step: 0.01 },
  { folder: 'Gouttes', key: 'dropletScale', label: 'finesse gouttes', min: 15, max: 120, step: 1 },
  { folder: 'Rendu', key: 'wetEdge', label: 'bords humides', min: 0, max: 2, step: 0.01 },
  { folder: 'Rendu', key: 'refraction', label: 'réfraction', min: 0, max: 2, step: 0.01 },
]

/** Facteur de largeur du trait selon la vitesse du doigt (écrans par seconde). */
export function strokeWidth(speed: number, params: Pick<FogParams, 'strokeThinning'>): number {
  const t = Math.min(Math.max((speed - 0.15) / (1.5 - 0.15), 0), 1)
  return 1 - params.strokeThinning * t * t * (3 - 2 * t)
}
