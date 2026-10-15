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
    expect(bus.drain().segments).toEqual([
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
    expect(bus.drain().segments).toEqual([{ a: { x: 0.5, y: 0.5 }, b: { x: 0.5, y: 0.5 } }])
  })

  it('keeps sources independent', () => {
    const bus = new InputBus()
    bus.strokeTo('mouse', { x: 0, y: 0 })
    bus.strokeTo('hand', { x: 1, y: 1 })
    bus.strokeTo('mouse', { x: 0.1, y: 0 })
    const { segments } = bus.drain()
    expect(segments[2]).toEqual({ a: { x: 0, y: 0 }, b: { x: 0.1, y: 0 } })
  })
})
