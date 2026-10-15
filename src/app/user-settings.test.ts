import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createParams, DEFAULT_PARAMS } from '../lib/fog/params'
import { applyStoredSettings, resetSettings, saveSettings } from './user-settings'

/** localStorage en mémoire (les tests tournent sous Node, sans navigateur). */
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('user settings', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('restores saved settings', () => {
    const params = createParams()
    params.strokeRadius = 0.05
    params.dripRate = 0
    saveSettings(params)
    const fresh = createParams()
    applyStoredSettings(fresh)
    expect(fresh.strokeRadius).toBe(0.05)
    expect(fresh.dripRate).toBe(0)
  })

  it('ignores corrupt or out-of-range values', () => {
    localStorage.setItem(
      'fog-mirror:settings',
      JSON.stringify({ strokeRadius: 5, veilOpacity: 'dense', evaporation: null }),
    )
    const params = createParams()
    applyStoredSettings(params)
    expect(params.strokeRadius).toBe(DEFAULT_PARAMS.strokeRadius)
    expect(params.veilOpacity).toBe(DEFAULT_PARAMS.veilOpacity)
    expect(params.evaporation).toBe(DEFAULT_PARAMS.evaporation)
  })

  it('ignores invalid JSON', () => {
    localStorage.setItem('fog-mirror:settings', '{oops')
    const params = createParams()
    applyStoredSettings(params)
    expect(params).toEqual(createParams())
  })

  it('keeps working when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué')
      },
      setItem: () => {
        throw new Error('bloqué')
      },
    })
    const params = createParams()
    expect(() => applyStoredSettings(params)).not.toThrow()
    expect(() => saveSettings(params)).not.toThrow()
  })

  it('resets to the defaults', () => {
    const params = createParams()
    params.strokeRadius = 0.05
    resetSettings(params)
    expect(params.strokeRadius).toBe(DEFAULT_PARAMS.strokeRadius)
  })
})
