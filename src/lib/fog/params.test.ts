import { describe, expect, it } from 'vitest'
import { strokeWidth } from './params'

describe('strokeWidth', () => {
  const params = { strokeThinning: 0.4 }

  it('keeps the full width for a slow finger', () => {
    expect(strokeWidth(0, params)).toBe(1)
    expect(strokeWidth(0.1, params)).toBe(1)
  })

  it('thins down to 1 - thinning for a fast finger', () => {
    expect(strokeWidth(1.5, params)).toBeCloseTo(0.6)
    expect(strokeWidth(5, params)).toBeCloseTo(0.6)
  })

  it('decreases smoothly with speed', () => {
    const widths = [0.2, 0.5, 0.8, 1.1, 1.4].map((s) => strokeWidth(s, params))
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1])
  })

  it('has no effect when thinning is 0', () => {
    expect(strokeWidth(3, { strokeThinning: 0 })).toBe(1)
  })
})
