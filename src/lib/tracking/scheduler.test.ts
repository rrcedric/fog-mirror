import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULER_PARAMS, pickTasks, type TaskCandidate } from './scheduler'

const P = DEFAULT_SCHEDULER_PARAMS // budget 14 ms, attente max 250 ms
const task = (name: string, lastRun: number, avgMs = 10, urgent = false): TaskCandidate => ({
  name,
  urgent,
  lastRun,
  avgMs,
})

describe('pickTasks', () => {
  it('runs every task when they fit in the budget', () => {
    expect(pickTasks([task('face', 0, 5), task('hand', 0, 6)], 33, P)).toEqual(['face', 'hand'])
  })

  it('runs every task the first time (no measured duration yet)', () => {
    const never = -Infinity
    expect(pickTasks([task('face', never, 0), task('hand', never, 0)], 0, P)).toHaveLength(2)
  })

  it('alternates by age when only one task fits', () => {
    expect(pickTasks([task('face', 100), task('hand', 66)], 133, P)).toEqual(['hand'])
    expect(pickTasks([task('face', 100), task('hand', 133)], 166, P)).toEqual(['face'])
  })

  it('always runs at least one task, even over budget', () => {
    expect(pickTasks([task('face', 0, 30)], 33, P)).toEqual(['face'])
  })

  it('gives priority to an urgent task', () => {
    expect(pickTasks([task('face', 0), task('hand', 100, 10, true)], 133, P)).toEqual(['hand'])
  })

  it('does not starve a task forever', () => {
    // La main écrit (urgente) mais le visage n'a pas tourné depuis 300 ms : il passe en premier.
    const picked = pickTasks([task('face', 0), task('hand', 266, 10, true)], 300, P)
    expect(picked[0]).toBe('face')
  })
})
