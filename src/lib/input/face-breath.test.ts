import { describe, expect, it } from 'vitest'
import { DEFAULT_BREATH_SHAPE_PARAMS, type MouthShape } from '../tracking/breath-shape'
import type { FaceObservation, FaceTracker } from '../tracking/face'
import { InputBus } from './events'
import { FaceBreathInput } from './face-breath'

const IDENTITY = { scale: [1, 1] as [number, number], offset: [0, 0] as [number, number] }

function face(shape: MouthShape): FaceObservation {
  return {
    mouth: { x: 0.3, y: 0.6 },
    innerLips: [],
    cheeks: [
      { x: 0.2, y: 0.5 },
      { x: 0.4, y: 0.5 },
    ],
    shape,
  }
}

/** Faux détecteur : renvoie l'observation qu'on lui donne. */
function setup(params = { ...DEFAULT_BREATH_SHAPE_PARAMS, smoothing: 0 }) {
  let next: FaceObservation | null = null
  const tracker = { detect: () => next } as unknown as FaceTracker
  const bus = new InputBus()
  const input = new FaceBreathInput(
    tracker,
    {} as HTMLVideoElement,
    bus,
    () => IDENTITY,
    () => 4 / 3,
    params,
  )
  let now = 0
  const step = (observation: FaceObservation | null) => {
    next = observation
    now += 1000 / 30
    input.run(now)
    return bus.drain().breaths
  }
  return { step, input, bus }
}

describe('FaceBreathInput', () => {
  it('breathes at the mirrored mouth position when the mouth is open', () => {
    const { step } = setup()
    const [breath] = step(face({ jawOpen: 0.5, mouthFunnel: 0.3, mouthPucker: 0 }))
    expect(breath.x).toBeCloseTo(0.7) // miroir : 1 - 0,3
    expect(breath.y).toBeCloseTo(0.6)
    expect(breath.intensity).toBeGreaterThan(0)
  })

  it('does not breathe with a closed mouth or without a face', () => {
    const { step } = setup()
    expect(step(face({ jawOpen: 0.02, mouthFunnel: 0, mouthPucker: 0 }))).toEqual([])
    expect(step(null)).toEqual([])
  })

  it('stops breathing when the mouth closes', () => {
    const { step } = setup()
    step(face({ jawOpen: 0.6, mouthFunnel: 0.3, mouthPucker: 0 }))
    expect(step(face({ jawOpen: 0, mouthFunnel: 0, mouthPucker: 0 }))).toEqual([])
  })

  it('scales the breath with the size of the face', () => {
    const { step } = setup()
    const [breath] = step(face({ jawOpen: 0.6, mouthFunnel: 0.3, mouthPucker: 0 }))
    // Visage de 0,2 largeur d'écran, soit 0,27 hauteur d'écran en 4/3 : un peu plus petit que la référence.
    expect(breath.scale).toBeGreaterThan(0.5)
    expect(breath.scale).toBeLessThan(1)
  })

  it('clears its breath on dispose', () => {
    const { step, input, bus } = setup()
    step(face({ jawOpen: 0.6, mouthFunnel: 0.3, mouthPucker: 0 }))
    input.dispose()
    expect(bus.drain().breaths).toEqual([])
  })
})
