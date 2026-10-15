import { DEFAULT_PARAMS, type FogParams } from '../lib/fog/params'
import type { NumericKey } from '../lib/param-spec'
import { loadJson, saveJson } from '../lib/ui/storage'

/** Réglage proposé à l'utilisateur (sous-ensemble simple des paramètres de la buée). */
export interface UserSetting {
  key: NumericKey<FogParams>
  label: string
  min: number
  max: number
  step: number
  /** Libellés des extrémités du curseur. */
  ends: [string, string]
}

export const USER_SETTINGS: UserSetting[] = [
  {
    key: 'strokeRadius',
    label: 'Épaisseur du trait',
    min: 0.02,
    max: 0.06,
    step: 0.001,
    ends: ['fin', 'épais'],
  },
  {
    key: 'veilOpacity',
    label: 'Intensité de la buée',
    min: 0.3,
    max: 0.85,
    step: 0.01,
    ends: ['légère', 'dense'],
  },
  {
    key: 'evaporation',
    label: 'Évaporation',
    min: 0.01,
    max: 0.2,
    step: 0.005,
    ends: ['lente', 'rapide'],
  },
  {
    key: 'refogAmount',
    label: 'Ré-embuage du tracé',
    min: 0,
    max: 1,
    step: 0.01,
    ends: ['aucun', 'complet'],
  },
  {
    key: 'dripRate',
    label: 'Gouttes qui coulent',
    min: 0,
    max: 8,
    step: 0.1,
    ends: ['aucune', 'beaucoup'],
  },
]

const STORAGE_KEY = 'settings'

type Stored = Partial<Record<NumericKey<FogParams>, number>>

/** Applique aux paramètres les réglages mémorisés (valeurs hors bornes ignorées). */
export function applyStoredSettings(params: FogParams): void {
  const stored = loadJson<Stored>(STORAGE_KEY, {})
  for (const s of USER_SETTINGS) {
    const v = stored[s.key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= s.min && v <= s.max) params[s.key] = v
  }
}

export function saveSettings(params: FogParams): void {
  saveJson(STORAGE_KEY, Object.fromEntries(USER_SETTINGS.map((s) => [s.key, params[s.key]])))
}

export function resetSettings(params: FogParams): void {
  for (const s of USER_SETTINGS) params[s.key] = DEFAULT_PARAMS[s.key]
  saveSettings(params)
}
