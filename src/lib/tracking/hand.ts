import { HandLandmarker } from '@mediapipe/tasks-vision'
import type { Point } from '../coords'
import type { Point3 } from './hand-landmarks'
import { assetUrl, createWithFallback, MonotonicClock, type Delegate } from './mediapipe'

/** Ce qu'on retient d'une main détectée. */
export interface HandObservation {
  /** 21 points en coordonnées vidéo normalisées (voir coords.ts). */
  landmarks: Point[]
  /** Les mêmes 21 points en mètres, centrés sur la main : distances isotropes pour les gestes. */
  world: Point3[]
}

/** Détection d'une main avec MediaPipe Hand Landmarker, entièrement locale. */
export class HandTracker {
  private readonly clock = new MonotonicClock()

  private constructor(
    private readonly landmarker: HandLandmarker,
    readonly delegate: Delegate,
  ) {}

  static async create(): Promise<HandTracker> {
    const { task, delegate } = await createWithFallback('HandLandmarker', (fileset, delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: assetUrl('models/hand_landmarker.task'), delegate },
        runningMode: 'VIDEO',
        numHands: 1,
      }),
    )
    return new HandTracker(task, delegate)
  }

  detect(video: HTMLVideoElement): HandObservation | null {
    const result = this.landmarker.detectForVideo(video, this.clock.now())
    const landmarks = result.landmarks[0]
    const world = result.worldLandmarks[0]
    if (!landmarks || !world) return null
    return {
      landmarks: landmarks.map(({ x, y }) => ({ x, y })),
      world: world.map(({ x, y, z }) => ({ x, y, z })),
    }
  }

  close(): void {
    this.landmarker.close()
  }
}
