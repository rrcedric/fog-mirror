import { describe, expect, it } from 'vitest'
import { InputBus } from './events'

describe('InputBus', () => {
  it('keeps a breath active until it is cleared', () => {
    const bus = new InputBus()
    bus.setBreath('mouse', { x: 0.5, y: 0.5, intensity: 1 })
    expect(bus.drain().breaths).toHaveLength(1)
    expect(bus.drain().breaths).toHaveLength(1)
    bus.setBreath('mouse', null)
    expect(bus.drain().breaths).toHaveLength(0)
  })

  it('ignores a zero-intensity breath', () => {
    const bus = new InputBus()
    bus.setBreath('face', { x: 0.5, y: 0.5, intensity: 0 })
    expect(bus.drain().breaths).toHaveLength(0)
  })

  it('turns stroke points into connected segments', () => {
    const bus = new InputBus()
    bus.strokeTo('mouse', { x: 0, y: 0 })
    bus.strokeTo('mouse', { x: 1, y: 0 })
    bus.strokeTo('mouse', { x: 1, y: 1 })
    expect(bus.drain().segments).toMatchObject([
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
      { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
      { a: { x: 1, y: 0 }, b: { x: 1, y: 1 } },
    ])
  })

  it('empties segments on drain and restarts after strokeEnd', () => {
    const bus = new InputBus()
    bus.strokeTo('mouse', { x: 0, y: 0 })
    bus.drain()
    expect(bus.drain().segments).toHaveLength(0)
    bus.strokeEnd('mouse')
    bus.strokeTo('mouse', { x: 0.5, y: 0.5 })
    expect(bus.drain().segments).toMatchObject([{ a: { x: 0.5, y: 0.5 }, b: { x: 0.5, y: 0.5 } }])
  })

  it('keeps sources independent', () => {
    const bus = new InputBus()
    bus.strokeTo('mouse', { x: 0, y: 0 })
    bus.strokeTo('hand', { x: 1, y: 1 })
    bus.strokeTo('mouse', { x: 0.1, y: 0 })
    const { segments } = bus.drain()
    expect(segments[2]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 } })
  })

  it('carries the finger speed, 0 by default', () => {
    const bus = new InputBus()
    bus.strokeTo('hand', { x: 0, y: 0, speed: 0.4 })
    bus.strokeTo('mouse', { x: 0, y: 0 })
    const [hand, mouse] = bus.drain().segments
    expect(hand.b.speed).toBe(0.4)
    expect(mouse.b.speed).toBe(0)
  })
})
