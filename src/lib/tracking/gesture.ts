import type { ParamSpec } from '../param-spec'
import { HAND, type Point3 } from './hand-landmarks'

/**
 * Extension de chaque doigt (hors pouce) : distance poignet → bout divisée par distance
 * poignet → articulation du milieu (PIP). Environ 1,5 pour un doigt tendu, moins de 1 pour un
 * doigt replié. Ce rapport ne dépend ni de la taille de la main ni de son inclinaison, contrairement
 * à une comparaison de hauteurs à l'écran.
 */
export interface HandPose {
  index: number
  middle: number
  ring: number
  pinky: number
}

const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

function extension(world: Point3[], tip: number, pip: number): number {
  const wrist = world[HAND.WRIST]
  const base = distance(world[pip], wrist)
  return base > 0 ? distance(world[tip], wrist) / base : 0
}

export function handPose(world: Point3[]): HandPose {
  return {
    index: extension(world, HAND.INDEX_TIP, HAND.INDEX_PIP),
    middle: extension(world, HAND.MIDDLE_TIP, HAND.MIDDLE_PIP),
    ring: extension(world, HAND.RING_TIP, HAND.RING_PIP),
    pinky: extension(world, HAND.PINKY_TIP, HAND.PINKY_PIP),
  }
}

export interface PointingParams {
  /** Extension de l'index pour commencer à écrire… */
  indexOn: number
  /** …et en dessous de laquelle on arrête (hystérésis). */
  indexOff: number
  /** Extension maximale des autres doigts pour commencer à écrire… */
  othersOn: number
  /** …et au-dessus de laquelle on arrête. */
  othersOff: number
}

export const DEFAULT_POINTING_PARAMS: PointingParams = {
  indexOn: 1.25,
  indexOff: 1.1,
  othersOn: 1.05,
  othersOff: 1.2,
}

export const POINTING_PARAM_SPECS: ParamSpec<PointingParams>[] = [
  { folder: 'Main', key: 'indexOn', label: 'index départ', min: 0.8, max: 2, step: 0.01 },
  { folder: 'Main', key: 'indexOff', label: 'index arrêt', min: 0.8, max: 2, step: 0.01 },
  { folder: 'Main', key: 'othersOn', label: 'autres départ', min: 0.5, max: 1.6, step: 0.01 },
  { folder: 'Main', key: 'othersOff', label: 'autres arrêt', min: 0.5, max: 1.6, step: 0.01 },
]

/** Reconnaît le geste « index tendu, autres doigts repliés », avec hystérésis. */
export class PointingDetector {
  private active = false

  constructor(private readonly params: PointingParams) {}

  update(pose: HandPose | null): boolean {
    if (!pose) {
      this.active = false
      return false
    }
    const p = this.params
    const others = Math.max(pose.middle, pose.ring, pose.pinky)
    this.active = this.active
      ? pose.index >= p.indexOff && others <= p.othersOff
      : pose.index >= p.indexOn && others <= p.othersOn
    return this.active
  }
}
