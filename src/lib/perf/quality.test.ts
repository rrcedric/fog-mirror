import { describe, expect, it } from 'vitest'
import { QUALITY_LEVELS, QualityGovernor } from './quality'

function feed(g: QualityGovernor, fps: number, seconds: number) {
  const changes = []
  for (let t = 0; t < seconds; t += 0.5) {
    const q = g.update(fps, 0.5)
    if (q) changes.push(q)
  }
  return changes
}

describe('QualityGovernor', () => {
  it('keeps the best quality while rendering is smooth', () => {
    const g = new QualityGovernor()
    expect(feed(g, 60, 30)).toEqual([])
    expect(g.level).toBe(0)
  })

  it('ignores a short drop', () => {
    const g = new QualityGovernor()
    expect(feed(g, 30, 1)).toEqual([])
  })

  it('lowers the quality step by step when rendering stays slow', () => {
    const g = new QualityGovernor()
    expect(feed(g, 30, 2)).toEqual([QUALITY_LEVELS[1]])
    expect(feed(g, 30, 2)).toEqual([QUALITY_LEVELS[2]])
  })

  it('never goes below the lightest level', () => {
    const g = new QualityGovernor()
    feed(g, 10, 60)
    expect(g.level).toBe(QUALITY_LEVELS.length - 1)
  })

  it('raises the quality back only after a long smooth period', () => {
    const g = new QualityGovernor()
    feed(g, 30, 2)
    expect(feed(g, 60, 10)).toEqual([])
    expect(feed(g, 60, 10)).toEqual([QUALITY_LEVELS[0]])
  })

  it('does not raise the quality while rendering is only fair', () => {
    const g = new QualityGovernor()
    feed(g, 30, 2)
    expect(feed(g, 50, 60)).toEqual([])
  })
})
