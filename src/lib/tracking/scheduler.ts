import { FpsMeter } from '../perf/fps'
import type { ParamSpec } from '../param-spec'

/** Une inférence à lancer sur les images de la caméra (visage, main…). */
export interface TrackingTask {
  readonly name: string
  run(now: number): void
  /** Vrai quand la tâche doit passer en priorité (par exemple, la main en train d'écrire). */
  urgent?(): boolean
}

export interface SchedulerParams {
  /** Temps de calcul maximal consacré au suivi par image de la caméra, en millisecondes. */
  budgetMs: number
  /** Au-delà de ce délai sans exécution, une tâche devient prioritaire, en millisecondes. */
  maxStalenessMs: number
}

export const DEFAULT_SCHEDULER_PARAMS: SchedulerParams = { budgetMs: 14, maxStalenessMs: 250 }

export const SCHEDULER_PARAM_SPECS: ParamSpec<SchedulerParams>[] = [
  { folder: 'Performances', key: 'budgetMs', label: 'budget (ms)', min: 4, max: 40, step: 1 },
  {
    folder: 'Performances',
    key: 'maxStalenessMs',
    label: 'attente max (ms)',
    min: 50,
    max: 1000,
    step: 10,
  },
]

export interface TaskCandidate {
  name: string
  urgent: boolean
  /** Instant de la dernière exécution, en millisecondes (-Infinity si jamais exécutée). */
  lastRun: number
  /** Durée moyenne d'une exécution, en millisecondes. */
  avgMs: number
}

/**
 * Choisit les tâches à exécuter sur une image : d'abord les urgentes et celles qui attendent
 * depuis trop longtemps, puis les plus anciennes, tant que le budget le permet. Au moins une
 * tâche tourne à chaque image.
 */
export function pickTasks(
  candidates: TaskCandidate[],
  now: number,
  params: SchedulerParams,
): string[] {
  const priority = (c: TaskCandidate) => c.urgent || now - c.lastRun > params.maxStalenessMs
  const ordered = [...candidates].sort((a, b) => {
    const pa = priority(a)
    const pb = priority(b)
    if (pa !== pb) return pa ? -1 : 1
    return a.lastRun - b.lastRun
  })
  const picked: string[] = []
  let spent = 0
  for (const c of ordered) {
    if (picked.length === 0 || spent + c.avgMs <= params.budgetMs) {
      picked.push(c.name)
      spent += c.avgMs
    }
  }
  return picked
}

export interface TaskStats {
  /** Exécutions par seconde. */
  rate: number
  /** Durée moyenne d'une exécution, en millisecondes. */
  avgMs: number
}

interface TaskState {
  task: TrackingTask
  lastRun: number
  avgMs: number
  rate: FpsMeter
}

/**
 * Lance les inférences à chaque nouvelle image de la caméra en respectant un budget de temps,
 * pour que le rendu reste fluide quand plusieurs modèles tournent.
 */
export class TrackingScheduler {
  private readonly tasks: TaskState[] = []
  private frameId = 0
  private rafId = 0
  private lastVideoTime = -1

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly params: SchedulerParams,
  ) {}

  add(task: TrackingTask): void {
    this.tasks.push({ task, lastRun: -Infinity, avgMs: 0, rate: new FpsMeter() })
  }

  start(): void {
    if (this.frameId || this.rafId) return
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
  }

  stats(name: string): TaskStats | null {
    const state = this.tasks.find((t) => t.task.name === name)
    return state ? { rate: state.rate.fps, avgMs: state.avgMs } : null
  }

  private step(now: number): void {
    const candidates = this.tasks.map((t) => ({
      name: t.task.name,
      urgent: t.task.urgent?.() ?? false,
      lastRun: t.lastRun,
      avgMs: t.avgMs,
    }))
    for (const name of pickTasks(candidates, now, this.params)) {
      const state = this.tasks.find((t) => t.task.name === name)!
      const t0 = performance.now()
      state.task.run(now)
      const ms = performance.now() - t0
      // La première mesure (chargement du modèle sur le GPU) est souvent très longue : on l'ignore.
      state.avgMs = state.lastRun === -Infinity ? 0 : state.avgMs + (ms - state.avgMs) * 0.1
      state.lastRun = now
      state.rate.tick(now)
    }
  }
}
