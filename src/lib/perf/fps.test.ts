import { describe, expect, it } from 'vitest'
import { FpsMeter } from './fps'

describe('FpsMeter', () => {
  it('reports 0 before two ticks', () => {
    const m = new FpsMeter()
    expect(m.fps).toBe(0)
    m.tick(0)
    expect(m.fps).toBe(0)
  })

  it('converges to the tick rate', () => {
    const m = new FpsMeter()
    for (let i = 0; i < 200; i++) m.tick(i * (1000 / 60))
    expect(m.fps).toBeCloseTo(60, 1)
  })

  it('drops when ticks stop arriving', () => {
    const m = new FpsMeter()
    for (let i = 0; i < 100; i++) m.tick(i * (1000 / 30))
    const last = 99 * (1000 / 30)
    expect(m.fpsAt(last + 10)).toBeCloseTo(30, 0)
    expect(m.fpsAt(last + 1000)).toBeCloseTo(1, 1)
  })
})
