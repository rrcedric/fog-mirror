// Plein écran, avec les variantes préfixées de Safari.

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

const doc = () => document as FullscreenDocument

export function fullscreenSupported(): boolean {
  return Boolean(doc().fullscreenEnabled || doc().webkitFullscreenEnabled)
}

export function isFullscreen(): boolean {
  return Boolean(doc().fullscreenElement || doc().webkitFullscreenElement)
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.())
    } else {
      const el = document.documentElement as FullscreenElement
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
    }
  } catch (err) {
    console.warn('Plein écran refusé', err)
  }
}

export function onFullscreenChange(callback: () => void): () => void {
  document.addEventListener('fullscreenchange', callback)
  document.addEventListener('webkitfullscreenchange', callback)
  return () => {
    document.removeEventListener('fullscreenchange', callback)
    document.removeEventListener('webkitfullscreenchange', callback)
  }
}
