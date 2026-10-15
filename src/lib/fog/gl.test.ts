import { describe, expect, it } from 'vitest'
import { resolveIncludes } from './gl'

describe('resolveIncludes', () => {
  it('replaces include lines with their chunk', () => {
    const src = '#version 300 es\n#include "noise.glsl"\nvoid main() {}'
    expect(resolveIncludes(src, { 'noise.glsl': 'float n() { return 0.0; }' })).toBe(
      '#version 300 es\nfloat n() { return 0.0; }\nvoid main() {}',
    )
  })

  it('leaves the version line first', () => {
    const out = resolveIncludes('#version 300 es\n#include "a"', { a: '// a' })
    expect(out.startsWith('#version 300 es\n')).toBe(true)
  })

  it('throws on an unknown include', () => {
    expect(() => resolveIncludes('#include "missing"', {})).toThrow(/missing/)
  })
})
