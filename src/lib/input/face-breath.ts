import { videoToScreen, type CoverTransform, type Point } from '../coords'
import { FpsMeter } from '../perf/fps'
import {
  BreathShapeDetector,
  type BreathShapeParams,
  type BreathShapeState,
} from '../tracking/breath-shape'
import type { FaceObservation, FaceTracker } from '../tracking/face'
import type { InputBus } from './events'

const SOURCE = 'face'
/** Largeur de visage (en hauteurs d'écran) pour laquelle la nappe de souffle a sa taille de base. */
const REFERENCE_FACE_WIDTH = 0.35

export interface FaceBreathDebug {
  /** Visage détecté, en coordonnées écran ; null si aucun visage. */
  face: { mouth: Point; innerLips: Point[]; observation: FaceObservation } | null
  breath: BreathShapeState
  detectFps: number
  /** Durée de la dernière inférence, en millisecondes. */
  inferenceMs: number
}

/**
 * Relie le suivi du visage au bus d'événements : à chaque nouvelle image de la caméra, détecte
 * la bouche et, si elle a une forme de souffle, émet un souffle à sa position à l'écran.
 */
export class FaceBreathInput {
  private readonly detector: BreathShapeDetector
  private readonly fps = new FpsMeter()
  private frameId = 0
  private rafId = 0
  private lastVideoTime = -1
  private lastTime = -1

  constructor(
    private readonly tracker: FaceTracker,
    private readonly video: HTMLVideoElement,
    private readonly bus: InputBus,
    private readonly getCover: () => CoverTransform,
    private readonly getAspect: () => number,
    params: BreathShapeParams,
    private readonly onDebug?: (debug: FaceBreathDebug) => void,
  ) {
    this.detector = new BreathShapeDetector(params)
  }

  start(): void {
    if ('requestVideoFrameCallback' in this.video) {
      const onFrame = (now: number) => {
        this.frameId = this.video.requestVideoFrameCallback(onFrame)
        this.step(now)
      }
      this.frameId = this.video.requestVideoFrameCallback(onFrame)
    } else {
      // Sans rVFC : on vérifie à chaque frame d'affichage si la vidéo a avancé.
      const loop = (now: number) => {
        this.rafId = requestAnimationFrame(loop)
        if (this.video.currentTime === this.lastVideoTime) return
        this.lastVideoTime = this.video.currentTime
        this.step(now)
      }
      this.rafId = requestAnimationFrame(loop)
    }
  }

  stop(): void {
    if (this.frameId) this.video.cancelVideoFrameCallback(this.frameId)
    cancelAnimationFrame(this.rafId)
    this.frameId = 0
    this.rafId = 0
    this.bus.setBreath(SOURCE, null)
  }

  private step(now: number): void {
    const dt = this.lastTime < 0 ? 0 : (now - this.lastTime) / 1000
    this.lastTime = now
    this.fps.tick(now)

    const t0 = performance.now()
    const observation = this.tracker.detect(this.video)
    const inferenceMs = performance.now() - t0
    const breath = this.detector.update(observation?.shape ?? null, dt)

    const cover = this.getCover()
    const toScreen = (p: Point) => videoToScreen(p, cover)
    let face: FaceBreathDebug['face'] = null
    if (observation) {
      const mouth = toScreen(observation.mouth)
      face = { mouth, innerLips: observation.innerLips.map(toScreen), observation }
      if (breath.active) {
        const [left, right] = observation.cheeks.map(toScreen)
        const faceWidth = Math.abs(right.x - left.x) * this.getAspect()
        const scale = Math.min(Math.max(faceWidth / REFERENCE_FACE_WIDTH, 0.5), 1.8)
        this.bus.setBreath(SOURCE, { ...mouth, intensity: breath.intensity, scale })
      }
    }
    if (!breath.active) this.bus.setBreath(SOURCE, null)

    this.onDebug?.({ face, breath, detectFps: this.fps.fps, inferenceMs })
  }
}
