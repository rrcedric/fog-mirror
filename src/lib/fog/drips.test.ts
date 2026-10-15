import { describe, expect, it } from 'vitest'
import { InputBus, type Segment } from '../input/events'
import { DripSystem, MAX_DRIPS, type DripParams } from './drips'

const PARAMS: DripParams = {
  dripRate: 4,
  dripSpeed: 0.1,
  dripWidth: 0.35,
  strokeRadius: 0.035,
  breathRadius: 0.2,
}

/** Générateur pseudo-aléatoire reproductible. */
function seeded(seed = 1) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const stroke = (length: number, source = 'hand'): Segment[] => [
  { a: { x: 0.3, y: 0.4, speed: 0 }, b: { x: 0.3 + length, y: 0.4, speed: 0 }, source },
]

/** Fait tourner le système pendant `seconds` secondes, à 60 images/s. */
function run(system: DripSystem, bus: InputBus, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    system.update(1 / 60, bus)
    bus.drain()
  }
}

describe('DripSystem', () => {
  it('forms drips some time after a long stroke', () => {
    const drips = new DripSystem(PARAMS, seeded())
    const bus = new InputBus()
    drips.observe(stroke(1), [], 1 / 60)
    expect(drips.count).toBe(0) // pas tout de suite
    run(drips, bus, 3)
    expect(drips.count + 0).toBeGreaterThan(0)
  })

  it('does not form drips from a tiny stroke', () => {
    const drips = new DripSystem(PARAMS, seeded())
    drips.observe(stroke(0.01), [], 1 / 60)
    run(drips, new InputBus(), 3)
    expect(drips.count).toBe(0)
  })

  it('ignores the trails of the drips themselves', () => {
    const drips = new DripSystem(PARAMS, seeded())
    drips.observe(stroke(1, 'drip:0'), [], 1 / 60)
    run(drips, new InputBus(), 3)
    expect(drips.count).toBe(0)
  })

  it('makes drips run down and draw a trail', () => {
    const drips = new DripSystem(PARAMS, seeded())
    const bus = new InputBus()
    drips.observe(stroke(1), [], 1 / 60)
    let trail: Segment[] = []
    let firstY: number | undefined
    for (let t = 0; t < 4; t += 1 / 60) {
      drips.update(1 / 60, bus)
      trail = trail.concat(bus.drain().segments.filter((s) => s.source.startsWith('drip:')))
      if (firstY === undefined && drips.count > 0) firstY = drips.heads()[0].y
    }
    expect(trail.length).toBeGreaterThan(10)
    for (const s of trail) expect(s.b.y).toBeGreaterThanOrEqual(s.a.y) // toujours vers le bas
    expect(trail.every((s) => s.b.width! < PARAMS.dripWidth + 1e-9)).toBe(true)
  })

  it('lets drips run out of water and stop', () => {
    const drips = new DripSystem(PARAMS, seeded())
    drips.observe(stroke(1), [], 1 / 60)
    run(drips, new InputBus(), 30)
    expect(drips.count).toBe(0)
  })

  it('caps the number of drips', () => {
    const drips = new DripSystem({ ...PARAMS, dripRate: 200 }, seeded())
    drips.observe(stroke(1), [], 1 / 60)
    run(drips, new InputBus(), 3)
    expect(drips.count).toBeLessThanOrEqual(MAX_DRIPS)
  })

  it('forms drips under a long breath', () => {
    const drips = new DripSystem(PARAMS, seeded())
    const bus = new InputBus()
    for (let t = 0; t < 10; t += 1 / 60) {
      drips.observe([], [{ x: 0.5, y: 0.4, intensity: 1 }], 1 / 60)
      drips.update(1 / 60, bus)
      bus.drain()
    }
    expect(drips.count).toBeGreaterThan(0)
  })

  it('does not form drips from a stroke on a clear mirror', () => {
    const drips = new DripSystem(PARAMS, seeded())
    drips.observe(stroke(1), [], 1 / 60, () => 0)
    run(drips, new InputBus(), 3)
    expect(drips.count).toBe(0)
  })

  it('forms fewer drips where the fog is thin', () => {
    const count = (density: number) => {
      const drips = new DripSystem(PARAMS, seeded())
      // Un trait d'un écran de long, en 50 petits segments comme un vrai geste.
      const segments: Segment[] = Array.from({ length: 50 }, (_, i) => ({
        a: { x: i * 0.02, y: 0.4, speed: 0 },
        b: { x: (i + 1) * 0.02, y: 0.4, speed: 0 },
        source: 'hand',
      }))
      drips.observe(segments, [], 1 / 60, () => density)
      run(drips, new InputBus(), 3)
      return drips.count
    }
    expect(count(0.3)).toBeLessThan(count(1))
  })

  it('does not form drips under a breath until the fog is thick', () => {
    const drips = new DripSystem(PARAMS, seeded())
    const bus = new InputBus()
    for (let t = 0; t < 10; t += 1 / 60) {
      drips.observe([], [{ x: 0.5, y: 0.4, intensity: 1 }], 1 / 60, () => 0.3)
      drips.update(1 / 60, bus)
      bus.drain()
    }
    expect(drips.count).toBe(0)
  })

  it('is disabled when the rate is 0', () => {
    const drips = new DripSystem({ ...PARAMS, dripRate: 0 }, seeded())
    drips.observe(stroke(1), [{ x: 0.5, y: 0.4, intensity: 1 }], 10)
    run(drips, new InputBus(), 3)
    expect(drips.count).toBe(0)
  })
})
