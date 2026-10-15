import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPEN_PALM_PARAMS,
  DEFAULT_POINTING_PARAMS,
  handPose,
  OpenPalmDetector,
  PointingDetector,
} from './gesture'
import type { Point3 } from './hand-landmarks'

type FingerState = 'extended' | 'curled'

/**
 * Main synthétique en mètres, poignet à l'origine, doigts vers le haut (-y).
 * Chaque doigt : MCP, PIP, DIP, bout.
 */
function hand(fingers: Record<'index' | 'middle' | 'ring' | 'pinky', FingerState>): Point3[] {
  const pts: Point3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  // Pouce replié contre la paume.
  for (let i = 1; i <= 4; i++) pts[i] = { x: 0.03 + i * 0.005, y: -0.03 - i * 0.01, z: 0.01 }
  const columns = {
    index: [5, 0.02],
    middle: [9, 0],
    ring: [13, -0.02],
    pinky: [17, -0.04],
  } as const
  for (const [name, [first, x]] of Object.entries(columns)) {
    const state = fingers[name as keyof typeof fingers]
    pts[first] = { x, y: -0.09, z: 0 }
    pts[first + 1] = { x, y: -0.13, z: 0 }
    if (state === 'extended') {
      pts[first + 2] = { x, y: -0.155, z: 0 }
      pts[first + 3] = { x, y: -0.175, z: 0 }
    } else {
      pts[first + 2] = { x, y: -0.115, z: 0.025 }
      pts[first + 3] = { x, y: -0.095, z: 0.03 }
    }
  }
  return pts
}

const pointing = hand({ index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' })
const open = hand({ index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' })
const fist = hand({ index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' })

describe('handPose', () => {
  it('measures an extended index and curled fingers', () => {
    const pose = handPose(pointing)
    expect(pose.index).toBeGreaterThan(1.3)
    expect(pose.middle).toBeLessThan(1)
    expect(pose.ring).toBeLessThan(1)
    expect(pose.pinky).toBeLessThan(1)
  })

  it('does not depend on the hand size', () => {
    const big = pointing.map((p) => ({ x: p.x * 1.4, y: p.y * 1.4, z: p.z * 1.4 }))
    expect(handPose(big).index).toBeCloseTo(handPose(pointing).index)
  })
})

describe('PointingDetector', () => {
  it('detects a pointing hand', () => {
    expect(new PointingDetector(DEFAULT_POINTING_PARAMS).update(handPose(pointing))).toBe(true)
  })

  it('ignores an open hand and a fist', () => {
    const d = new PointingDetector(DEFAULT_POINTING_PARAMS)
    expect(d.update(handPose(open))).toBe(false)
    expect(d.update(handPose(fist))).toBe(false)
  })

  it('stops when the hand is lost', () => {
    const d = new PointingDetector(DEFAULT_POINTING_PARAMS)
    d.update(handPose(pointing))
    expect(d.update(null)).toBe(false)
  })

  it('uses hysteresis on the index extension', () => {
    const d = new PointingDetector(DEFAULT_POINTING_PARAMS)
    const curled = { middle: 0.8, ring: 0.8, pinky: 0.8 }
    expect(d.update({ index: 1.2, ...curled })).toBe(false) // entre les seuils : pas encore
    expect(d.update({ index: 1.4, ...curled })).toBe(true)
    expect(d.update({ index: 1.2, ...curled })).toBe(true) // entre les seuils : on continue
    expect(d.update({ index: 1.0, ...curled })).toBe(false)
  })
})

describe('OpenPalmDetector', () => {
  const openPose = handPose(open)
  const run = (d: OpenPalmDetector, pose: ReturnType<typeof handPose> | null, seconds: number) => {
    let triggers = 0
    let last = { progress: 0, triggered: false }
    for (let t = 0; t < seconds; t += 1 / 30) {
      last = d.update(pose, 1 / 30)
      if (last.triggered) triggers++
    }
    return { triggers, last }
  }

  it('triggers once after holding an open hand', () => {
    const d = new OpenPalmDetector(DEFAULT_OPEN_PALM_PARAMS)
    expect(run(d, openPose, 0.5).triggers).toBe(0)
    expect(run(d, openPose, 0.6).triggers).toBe(1)
    expect(run(d, openPose, 3).triggers).toBe(0) // pas de répétition tant que la main reste ouverte
  })

  it('reports the hold progress', () => {
    const d = new OpenPalmDetector(DEFAULT_OPEN_PALM_PARAMS)
    const { last } = run(d, openPose, 0.5)
    expect(last.progress).toBeGreaterThan(0.4)
    expect(last.progress).toBeLessThan(0.6)
  })

  it('needs the hand to close before triggering again', () => {
    const d = new OpenPalmDetector(DEFAULT_OPEN_PALM_PARAMS)
    run(d, openPose, 1.2)
    run(d, handPose(fist), 0.2)
    expect(run(d, openPose, 1.2).triggers).toBe(1)
  })

  it('ignores a pointing hand and a lost hand', () => {
    const d = new OpenPalmDetector(DEFAULT_OPEN_PALM_PARAMS)
    expect(run(d, handPose(pointing), 2).triggers).toBe(0)
    expect(run(d, null, 2).triggers).toBe(0)
  })
})
