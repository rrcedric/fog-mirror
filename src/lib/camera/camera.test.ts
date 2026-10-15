import { describe, expect, it } from 'vitest'
import { CameraError, classifyCameraError } from './camera'

const domError = (name: string) => Object.assign(new Error(name), { name })

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['WhateverError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(classifyCameraError(domError(name))).toBe(kind)
  })

  it('keeps the kind of an existing CameraError', () => {
    expect(classifyCameraError(new CameraError('insecure'))).toBe('insecure')
  })

  it('handles non-error values', () => {
    expect(classifyCameraError(undefined)).toBe('unknown')
    expect(classifyCameraError('boom')).toBe('unknown')
  })
})
