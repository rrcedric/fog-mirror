import { FaceLandmarker, type Category } from '@mediapipe/tasks-vision'
import type { Point } from '../coords'
import type { MouthShape } from './breath-shape'
import { assetUrl, createWithFallback, MonotonicClock, type Delegate } from './mediapipe'

/** Ce qu'on retient d'un visage détecté. Coordonnées vidéo normalisées (voir coords.ts). */
export interface FaceObservation {
  /** Centre de la bouche (entre les lèvres intérieures). */
  mouth: Point
  /** Contour intérieur des lèvres, pour l'overlay de debug. */
  innerLips: Point[]
  /** Bords gauche et droit du visage (joues), pour estimer sa taille. */
  cheeks: [Point, Point]
  shape: MouthShape
}

// Indices des 478 landmarks de MediaPipe Face Mesh.
const UPPER_INNER_LIP = 13
const LOWER_INNER_LIP = 14
const CHEEKS = [234, 454] as const
const INNER_LIPS = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
]

function blendshape(categories: Category[], name: string): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0
}

/** Détection du visage et de la bouche avec MediaPipe Face Landmarker, entièrement locale. */
export class FaceTracker {
  private readonly clock = new MonotonicClock()

  private constructor(
    private readonly landmarker: FaceLandmarker,
    readonly delegate: Delegate,
  ) {}

  /** Charge le modèle, sur GPU si possible, sinon sur CPU. */
  static async create(): Promise<FaceTracker> {
    const { task, delegate } = await createWithFallback('FaceLandmarker', (fileset, delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: assetUrl('models/face_landmarker.task'), delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
    )
    return new FaceTracker(task, delegate)
  }

  detect(video: HTMLVideoElement): FaceObservation | null {
    const result = this.landmarker.detectForVideo(video, this.clock.now())
    const landmarks = result.faceLandmarks[0]
    if (!landmarks) return null

    const point = (i: number): Point => ({ x: landmarks[i].x, y: landmarks[i].y })
    const upper = point(UPPER_INNER_LIP)
    const lower = point(LOWER_INNER_LIP)
    const categories = result.faceBlendshapes[0]?.categories ?? []
    return {
      mouth: { x: (upper.x + lower.x) / 2, y: (upper.y + lower.y) / 2 },
      innerLips: INNER_LIPS.map(point),
      cheeks: [point(CHEEKS[0]), point(CHEEKS[1])],
      shape: {
        jawOpen: blendshape(categories, 'jawOpen'),
        mouthFunnel: blendshape(categories, 'mouthFunnel'),
        mouthPucker: blendshape(categories, 'mouthPucker'),
      },
    }
  }

  close(): void {
    this.landmarker.close()
  }
}
