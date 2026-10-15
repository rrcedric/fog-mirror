import { FilesetResolver } from '@mediapipe/tasks-vision'

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

/** URL d'un fichier servi par le site (dossier public/), quel que soit le sous-chemin. */
export function assetUrl(path: string): string {
  return new URL(import.meta.env.BASE_URL + path, location.href).href
}

let fileset: Promise<WasmFileset> | undefined

/** Runtime WASM de MediaPipe, chargé une seule fois pour tous les modèles. */
export function visionFileset(): Promise<WasmFileset> {
  fileset ??= FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'))
  return fileset
}

export type Delegate = 'GPU' | 'CPU'

/** Crée un modèle sur GPU si possible, sinon sur CPU. */
export async function createWithFallback<T>(
  name: string,
  create: (fileset: WasmFileset, delegate: Delegate) => Promise<T>,
): Promise<{ task: T; delegate: Delegate }> {
  const files = await visionFileset()
  let lastError: unknown
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      return { task: await create(files, delegate), delegate }
    } catch (err) {
      console.warn(`${name} (${delegate}) indisponible`, err)
      lastError = err
    }
  }
  throw lastError
}

/** Horloge strictement croissante, exigée par les modèles MediaPipe en mode VIDEO. */
export class MonotonicClock {
  private last = 0

  now(): number {
    this.last = Math.max(performance.now(), this.last + 1)
    return this.last
  }
}
