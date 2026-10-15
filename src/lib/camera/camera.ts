export type CameraErrorKind =
  'insecure' | 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'ended' | 'unknown'

export class CameraError extends Error {
  readonly kind: CameraErrorKind

  constructor(kind: CameraErrorKind, cause?: unknown) {
    super(`Camera error: ${kind}`, { cause })
    this.name = 'CameraError'
    this.kind = kind
  }
}

/** Traduit l'exception levée par getUserMedia en une catégorie affichable. */
export function classifyCameraError(err: unknown): CameraErrorKind {
  if (err instanceof CameraError) return err.kind
  const name = (err as { name?: unknown } | null)?.name
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use'
    default:
      return 'unknown'
  }
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60 },
  },
}

export async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new CameraError('insecure')
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
  } catch (err) {
    throw new CameraError(classifyCameraError(err), err)
  }
}

export function closeCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}
