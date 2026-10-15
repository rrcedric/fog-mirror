import { describe, expect, it } from 'vitest'
import { advance, stepNumber } from './onboarding'

describe('onboarding', () => {
  it('goes through the steps in order as the user does them', () => {
    expect(advance('breathe', 'breathed')).toBe('write')
    expect(advance('write', 'wrote')).toBe('clear')
    expect(advance('clear', 'cleared')).toBe('done')
  })

  it('ignores actions that belong to another step', () => {
    expect(advance('breathe', 'wrote')).toBe('breathe')
    expect(advance('write', 'cleared')).toBe('write')
  })

  it('lets the user move on or skip', () => {
    expect(advance('breathe', 'next')).toBe('write')
    expect(advance('write', 'skip')).toBe('done')
    expect(advance('done', 'next')).toBe('done')
  })

  it('numbers the steps from 1', () => {
    expect(stepNumber('breathe')).toBe(1)
    expect(stepNumber('clear')).toBe(3)
  })
})
