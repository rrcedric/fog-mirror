import { describe, expect, it } from 'vitest'
import { DEFAULT_ONE_EURO_PARAMS, OneEuroFilter } from './filters'

const DT = 1 / 30

function random(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

describe('OneEuroFilter', () => {
  it('returns the first value unchanged', () => {
    expect(new OneEuroFilter(DEFAULT_ONE_EURO_PARAMS).filter(0.4, 0)).toBe(0.4)
  })

  it('reduces jitter around a fixed position', () => {
    const f = new OneEuroFilter(DEFAULT_ONE_EURO_PARAMS)
    const rand = random(3)
    const out: number[] = []
    for (let i = 0; i < 120; i++) out.push(f.filter(0.5 + (rand() - 0.5) * 0.01, i * DT))
    const tail = out.slice(60)
    const spread = Math.max(...tail) - Math.min(...tail)
    expect(spread).toBeLessThan(0.005) // l'entrée varie de 0,01
  })

  it('follows a fast movement with little lag', () => {
    const f = new OneEuroFilter(DEFAULT_ONE_EURO_PARAMS)
    let last = 0
    for (let i = 0; i <= 15; i++) last = f.filter(i / 15, i * DT) // 1 écran en 0,5 s
    expect(last).toBeGreaterThan(0.85)
  })

  it('starts over after reset', () => {
    const f = new OneEuroFilter(DEFAULT_ONE_EURO_PARAMS)
    f.filter(0, 0)
    f.reset()
    expect(f.filter(1, DT)).toBe(1)
  })
})
