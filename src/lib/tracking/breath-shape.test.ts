import { describe, expect, it } from 'vitest'
import {
  BreathShapeDetector,
  DEFAULT_BREATH_SHAPE_PARAMS,
  breathShapeScore,
  type MouthShape,
} from './breath-shape'

const closed: MouthShape = { jawOpen: 0.02, mouthFunnel: 0.01, mouthPucker: 0.05 }
const blowing: MouthShape = { jawOpen: 0.3, mouthFunnel: 0.4, mouthPucker: 0.1 }
const unsmoothed = { ...DEFAULT_BREATH_SHAPE_PARAMS, smoothing: 0 }

describe('breathShapeScore', () => {
  it('is low for a closed mouth and high for a blowing mouth', () => {
    expect(breathShapeScore(closed, DEFAULT_BREATH_SHAPE_PARAMS)).toBeLessThan(0.1)
    expect(breathShapeScore(blowing, DEFAULT_BREATH_SHAPE_PARAMS)).toBeGreaterThan(0.6)
  })
})

describe('BreathShapeDetector', () => {
  it('stays inactive for a closed mouth', () => {
    const d = new BreathShapeDetector(unsmoothed)
    expect(d.update(closed, 1 / 30)).toMatchObject({ active: false, intensity: 0 })
  })

  it('activates above the on threshold', () => {
    const d = new BreathShapeDetector(unsmoothed)
    const s = d.update(blowing, 1 / 30)
    expect(s.active).toBe(true)
    expect(s.intensity).toBeGreaterThan(0.5)
  })

  it('uses hysteresis between the on and off thresholds', () => {
    const p = { ...unsmoothed, weightFunnel: 0, weightPucker: 0 }
    const d = new BreathShapeDetector(p)
    const jaw = (jawOpen: number): MouthShape => ({ jawOpen, mouthFunnel: 0, mouthPucker: 0 })
    expect(d.update(jaw(0.3), 0.03).active).toBe(false) // entre les seuils, pas encore actif
    expect(d.update(jaw(0.4), 0.03).active).toBe(true)
    expect(d.update(jaw(0.3), 0.03).active).toBe(true) // entre les seuils, reste actif
    expect(d.update(jaw(0.1), 0.03).active).toBe(false)
  })

  it('smooths the score over time', () => {
    const d = new BreathShapeDetector({ ...DEFAULT_BREATH_SHAPE_PARAMS, smoothing: 0.1 })
    const first = d.update(blowing, 1 / 30)
    expect(first.score).toBeLessThan(breathShapeScore(blowing, DEFAULT_BREATH_SHAPE_PARAMS))
    let s = first
    for (let i = 0; i < 30; i++) s = d.update(blowing, 1 / 30)
    expect(s.score).toBeCloseTo(breathShapeScore(blowing, DEFAULT_BREATH_SHAPE_PARAMS), 2)
  })

  it('resets when the face is lost', () => {
    const d = new BreathShapeDetector(unsmoothed)
    d.update(blowing, 1 / 30)
    expect(d.update(null, 1 / 30)).toEqual({ score: 0, active: false, intensity: 0 })
  })
})
