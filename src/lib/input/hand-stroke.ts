import { videoToScreen, type CoverTransform, type Point } from '../coords'
import { FpsMeter } from '../perf/fps'
import { OneEuroFilter2D, type OneEuroParams } from '../tracking/filters'
import { handPose, PointingDetector, type HandPose, type PointingParams } from '../tracking/gesture'
import type { HandTracker } from '../tracking/hand'
import { HAND } from '../tracking/hand-landmarks'
import type { TrackingTask } from '../tracking/scheduler'
import type { InputBus } from './events'
import { StrokeSmoother } from './smoother'
import { SpeedMeter } from './speed'

const SOURCE = 'hand'

/** Position du bout de l'index à l'écran, pour afficher le curseur. */
export interface HandCursor {
  /** Coordonnées écran normalisées, filtrées. */
  position: Point
  drawing: boolean
}

export interface HandStrokeDebug {
  /** Les 21 points de la main en coordonnées écran ; null si aucune main. */
  landmarks: Point[] | null
  pose: HandPose | null
  drawing: boolean
  detectFps: number
  inferenceMs: number
}

export interface HandStrokeOptions {
  getCover: () => CoverTransform
  pointingParams: PointingParams
  filterParams: OneEuroParams
  onCursor?: (cursor: HandCursor | null) => void
  onDebug?: (debug: HandStrokeDebug) => void
}

/**
 * Relie le suivi de la main au bus d'événements : quand l'index est tendu (et les autres doigts
 * repliés), le bout de l'index trace dans la buée. La position est lissée par un filtre One Euro,
 * puis la trajectoire est arrondie en courbes entre deux détections.
 */
export class HandStrokeInput implements TrackingTask {
  readonly name = 'hand'
  private readonly pointing: PointingDetector
  private readonly filter: OneEuroFilter2D
  private readonly fps = new FpsMeter()
  private readonly speed = new SpeedMeter()
  private readonly smoother = new StrokeSmoother()
  private drawing = false

  constructor(
    private readonly tracker: HandTracker,
    private readonly video: HTMLVideoElement,
    private readonly bus: InputBus,
    private readonly options: HandStrokeOptions,
  ) {
    this.pointing = new PointingDetector(options.pointingParams)
    this.filter = new OneEuroFilter2D(options.filterParams)
  }

  /** Prioritaire pendant qu'on écrit, pour un tracé fluide. */
  urgent(): boolean {
    return this.drawing
  }

  dispose(): void {
    this.endStroke()
  }

  private endStroke(): void {
    for (const p of this.smoother.end()) this.bus.strokeTo(SOURCE, p)
    this.bus.strokeEnd(SOURCE)
  }

  run(now: number): void {
    this.fps.tick(now)
    const t0 = performance.now()
    const observation = this.tracker.detect(this.video)
    const inferenceMs = performance.now() - t0

    const pose = observation ? handPose(observation.world) : null
    const drawing = this.pointing.update(pose)
    const cover = this.options.getCover()
    const toScreen = (p: Point) => videoToScreen(p, cover)

    let landmarks: Point[] | null = null
    if (observation) {
      landmarks = observation.landmarks.map(toScreen)
      const tip = this.filter.filter(landmarks[HAND.INDEX_TIP], now / 1000)
      const speed = this.speed.update(tip, now / 1000)
      if (drawing) {
        for (const p of this.smoother.push({ ...tip, speed })) this.bus.strokeTo(SOURCE, p)
      } else if (this.drawing) {
        this.endStroke()
      }
      this.options.onCursor?.({ position: tip, drawing })
    } else {
      this.filter.reset()
      this.speed.reset()
      if (this.drawing) this.endStroke()
      this.options.onCursor?.(null)
    }
    this.drawing = drawing

    this.options.onDebug?.({
      landmarks,
      pose,
      drawing,
      detectFps: this.fps.fps,
      inferenceMs,
    })
  }
}
