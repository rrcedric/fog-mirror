import { describe, expect, it } from 'vitest'
import { SpeedMeter } from './speed'

describe('SpeedMeter', () => {
  it('starts at 0', () => {
    expect(new SpeedMeter().update({ x: 0, y: 0 }, 0)).toBe(0)
  })

  it('converges to a constant speed', () => {
    const m = new SpeedMeter()
    let v = 0
    for (let i = 0; i <= 30; i++) v = m.update({ x: i * 0.02, y: 0 }, i / 30) // 0,6 écran/s
    expect(v).toBeCloseTo(0.6, 2)
  })

  it('ignores repeated timestamps and restarts after reset', () => {
    const m = new SpeedMeter()
    m.update({ x: 0, y: 0 }, 0)
    expect(m.update({ x: 1, y: 0 }, 0)).toBe(0)
    m.reset()
    expect(m.update({ x: 5, y: 5 }, 1)).toBe(0)
  })
})
