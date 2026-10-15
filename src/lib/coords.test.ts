import { describe, expect, it } from 'vitest'
import { coverTransform, screenToVideo, videoToScreen } from './coords'

describe('coverTransform', () => {
  it('is the identity when aspects match', () => {
    expect(coverTransform(16 / 9, 16 / 9)).toEqual({ scale: [1, 1], offset: [0, 0] })
  })

  it('crops left and right when the source is wider', () => {
    const t = coverTransform(16 / 9, 1)
    expect(t.scale[0]).toBeCloseTo(9 / 16)
    expect(t.scale[1]).toBe(1)
    expect(t.offset[0]).toBeCloseTo(7 / 32)
    expect(t.offset[1]).toBe(0)
  })

  it('crops top and bottom when the source is taller', () => {
    const t = coverTransform(4 / 3, 16 / 9)
    expect(t.scale[0]).toBe(1)
    expect(t.scale[1]).toBeCloseTo(3 / 4)
    expect(t.offset[1]).toBeCloseTo(1 / 8)
  })
})

describe('screenToVideo / videoToScreen', () => {
  const t = coverTransform(16 / 9, 4 / 3)

  it('mirrors horizontally', () => {
    const left = screenToVideo({ x: 0, y: 0.5 }, t)
    const right = screenToVideo({ x: 1, y: 0.5 }, t)
    expect(left.x).toBeGreaterThan(right.x)
  })

  it('maps the screen center to the video center', () => {
    const c = screenToVideo({ x: 0.5, y: 0.5 }, t)
    expect(c.x).toBeCloseTo(0.5)
    expect(c.y).toBeCloseTo(0.5)
  })

  it('round-trips', () => {
    for (const p of [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.7 },
      { x: 0.5, y: 0 },
    ]) {
      const back = videoToScreen(screenToVideo(p, t), t)
      expect(back.x).toBeCloseTo(p.x)
      expect(back.y).toBeCloseTo(p.y)
    }
  })
})
