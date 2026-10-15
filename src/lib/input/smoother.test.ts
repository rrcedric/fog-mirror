import { describe, expect, it } from 'vitest'
import { StrokeSmoother, type SpeedPoint } from './smoother'

const pt = (x: number, y: number, speed = 0): SpeedPoint => ({ x, y, speed })

function run(points: SpeedPoint[], spacing = 0.01): SpeedPoint[] {
  const s = new StrokeSmoother(spacing)
  return [...points.flatMap((p) => s.push(p)), ...s.end()]
}

describe('StrokeSmoother', () => {
  it('emits the first point right away', () => {
    expect(new StrokeSmoother().push(pt(0.2, 0.3))).toEqual([pt(0.2, 0.3)])
  })

  it('starts on the first point and ends on the last one', () => {
    const out = run([pt(0, 0), pt(0.1, 0), pt(0.2, 0.1), pt(0.3, 0.1)])
    expect(out[0]).toEqual(pt(0, 0))
    expect(out.at(-1)!.x).toBeCloseTo(0.3)
    expect(out.at(-1)!.y).toBeCloseTo(0.1)
  })

  it('keeps a straight line straight', () => {
    const out = run([pt(0, 0.5), pt(0.1, 0.5), pt(0.2, 0.5), pt(0.3, 0.5)])
    for (const p of out) expect(p.y).toBeCloseTo(0.5)
  })

  it('rounds a sharp corner', () => {
    // Angle droit en (0.2, 0) : le tracé lissé passe à l'intérieur du coin.
    const out = run([pt(0, 0), pt(0.2, 0), pt(0.2, 0.2)])
    const closest = Math.min(...out.map((p) => Math.hypot(p.x - 0.2, p.y)))
    expect(closest).toBeGreaterThan(0.03)
  })

  it('emits points no further apart than the spacing', () => {
    const out = run([pt(0, 0), pt(0.2, 0), pt(0.2, 0.2), pt(0, 0.2)], 0.01)
    for (let i = 1; i < out.length; i++) {
      expect(Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)).toBeLessThan(0.0105)
    }
  })

  it('interpolates the speed', () => {
    const out = run([pt(0, 0, 0), pt(0.1, 0, 1), pt(0.2, 0, 1)])
    const speeds = out.map((p) => p.speed)
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...speeds)).toBeLessThanOrEqual(1)
    expect(speeds.at(-1)).toBe(1)
  })
})
