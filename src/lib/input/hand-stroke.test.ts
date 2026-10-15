import { describe, expect, it } from 'vitest'
import { DEFAULT_ONE_EURO_PARAMS } from '../tracking/filters'
import { DEFAULT_OPEN_PALM_PARAMS, DEFAULT_POINTING_PARAMS } from '../tracking/gesture'
import type { HandObservation, HandTracker } from '../tracking/hand'
import { HAND } from '../tracking/hand-landmarks'
import { hand, type FingerState } from '../tracking/test-hands'
import { InputBus } from './events'
import { HandStrokeInput, type HandCursor } from './hand-stroke'

const IDENTITY = { scale: [1, 1] as [number, number], offset: [0, 0] as [number, number] }

function observation(fingers: FingerState[], tip = { x: 0.5, y: 0.5 }): HandObservation {
  const [index, middle, ring, pinky] = fingers
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }))
  landmarks[HAND.INDEX_TIP] = tip
  return { landmarks, world: hand({ index, middle, ring, pinky }) }
}

const POINTING: FingerState[] = ['extended', 'curled', 'curled', 'curled']
const OPEN: FingerState[] = ['extended', 'extended', 'extended', 'extended']

function setup() {
  let next: HandObservation | null = null
  const tracker = { detect: () => next } as unknown as HandTracker
  const bus = new InputBus()
  const events = { clears: 0, cursor: null as HandCursor | null }
  const input = new HandStrokeInput(tracker, {} as HTMLVideoElement, bus, {
    getCover: () => IDENTITY,
    pointingParams: DEFAULT_POINTING_PARAMS,
    openPalmParams: DEFAULT_OPEN_PALM_PARAMS,
    filterParams: DEFAULT_ONE_EURO_PARAMS,
    onClear: () => events.clears++,
    onCursor: (c) => (events.cursor = c),
  })
  let now = 0
  const step = (obs: HandObservation | null) => {
    next = obs
    now += 1000 / 30
    input.run(now)
    return bus.drain().segments
  }
  return { step, events, input }
}

describe('HandStrokeInput', () => {
  it('draws while the index points, at the mirrored fingertip', () => {
    const { step, events } = setup()
    let segments = step(observation(POINTING, { x: 0.3, y: 0.4 }))
    for (let i = 1; i <= 10; i++) {
      segments = segments.concat(step(observation(POINTING, { x: 0.3 + i * 0.01, y: 0.4 })))
    }
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.every((s) => s.source === 'hand')).toBe(true)
    // Miroir : le doigt va vers la droite de la caméra, donc vers la gauche à l'écran.
    expect(segments.at(-1)!.b.x).toBeLessThan(segments[0].a.x)
    expect(events.cursor?.drawing).toBe(true)
  })

  it('shows the cursor without drawing for an open hand', () => {
    const { step, events } = setup()
    expect(step(observation(OPEN))).toEqual([])
    expect(events.cursor?.drawing).toBe(false)
  })

  it('hides the cursor when the hand is lost', () => {
    const { step, events } = setup()
    step(observation(OPEN))
    step(null)
    expect(events.cursor).toBeNull()
  })

  it('clears everything after holding an open hand', () => {
    const { step, events } = setup()
    for (let i = 0; i < 20; i++) step(observation(OPEN)) // ≈ 0,67 s
    expect(events.clears).toBe(0)
    expect(events.cursor?.clearProgress).toBeGreaterThan(0.5)
    for (let i = 0; i < 15; i++) step(observation(OPEN))
    expect(events.clears).toBe(1)
  })

  it('is urgent only while drawing', () => {
    const { step, input } = setup()
    step(observation(OPEN))
    expect(input.urgent()).toBe(false)
    step(observation(POINTING))
    expect(input.urgent()).toBe(true)
  })
})
