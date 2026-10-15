<script lang="ts">
  import { onMount } from 'svelte'
  import { MirrorEngine, type EngineStats } from '../lib/fog/engine'
  import { createParams, DEFAULT_PARAMS, FOG_PARAM_SPECS } from '../lib/fog/params'
  import { InputBus } from '../lib/input/events'
  import { FaceBreathInput, type FaceBreathDebug } from '../lib/input/face-breath'
  import { HandStrokeInput, type HandCursor, type HandStrokeDebug } from '../lib/input/hand-stroke'
  import { attachPointerInput } from '../lib/input/pointer'
  import { paramGroup } from '../lib/param-spec'
  import {
    BREATH_SHAPE_PARAM_SPECS,
    DEFAULT_BREATH_SHAPE_PARAMS,
  } from '../lib/tracking/breath-shape'
  import type { FaceTracker } from '../lib/tracking/face'
  import { DEFAULT_ONE_EURO_PARAMS, ONE_EURO_PARAM_SPECS } from '../lib/tracking/filters'
  import { DEFAULT_POINTING_PARAMS, POINTING_PARAM_SPECS } from '../lib/tracking/gesture'
  import type { HandTracker } from '../lib/tracking/hand'
  import {
    DEFAULT_SCHEDULER_PARAMS,
    SCHEDULER_PARAM_SPECS,
    TrackingScheduler,
    type TaskStats,
  } from '../lib/tracking/scheduler'
  import DebugOverlay from './DebugOverlay.svelte'
  import DevPanel from './DevPanel.svelte'
  import HandCursorView from './HandCursor.svelte'
  import TrackingOverlay from './TrackingOverlay.svelte'
  import type { AppErrorKind } from './messages'
  import type { TrackerStatus } from './tracking-status'

  interface Props {
    stream: MediaStream
    onerror: (kind: AppErrorKind) => void
  }

  let { stream, onerror }: Props = $props()

  // Objets simples (non réactifs) : lus en continu par le moteur et le suivi, modifiés par le panneau.
  const params = createParams()
  const faceParams = { ...DEFAULT_BREATH_SHAPE_PARAMS }
  const pointingParams = { ...DEFAULT_POINTING_PARAMS }
  const filterParams = { ...DEFAULT_ONE_EURO_PARAMS }
  const schedulerParams = { ...DEFAULT_SCHEDULER_PARAMS }
  const paramGroups = [
    paramGroup(faceParams, BREATH_SHAPE_PARAM_SPECS, DEFAULT_BREATH_SHAPE_PARAMS),
    paramGroup(pointingParams, POINTING_PARAM_SPECS, DEFAULT_POINTING_PARAMS),
    paramGroup(filterParams, ONE_EURO_PARAM_SPECS, DEFAULT_ONE_EURO_PARAMS),
    paramGroup(params, FOG_PARAM_SPECS, DEFAULT_PARAMS),
    paramGroup(schedulerParams, SCHEDULER_PARAM_SPECS, DEFAULT_SCHEDULER_PARAMS),
  ]
  const input = new InputBus()

  let canvas: HTMLCanvasElement
  let video: HTMLVideoElement
  let engine: MirrorEngine | undefined
  let scheduler: TrackingScheduler | undefined
  let showDebug = $state(import.meta.env.DEV)
  let stats = $state<EngineStats | null>(null)
  let taskStats = $state<{ face: TaskStats | null; hand: TaskStats | null }>({
    face: null,
    hand: null,
  })
  let faceStatus = $state<TrackerStatus>({ name: 'loading' })
  let handStatus = $state<TrackerStatus>({ name: 'loading' })
  let faceDebug = $state<FaceBreathDebug | null>(null)
  let handDebug = $state<HandStrokeDebug | null>(null)
  let handCursor = $state<HandCursor | null>(null)

  onMount(() => {
    let disposed = false
    let faceTracker: FaceTracker | undefined
    let handTracker: HandTracker | undefined
    let faceInput: FaceBreathInput | undefined
    let handInput: HandStrokeInput | undefined
    const track = stream.getVideoTracks()[0]
    const onEnded = () => onerror('ended')
    track?.addEventListener('ended', onEnded)
    const detachPointer = attachPointerInput(canvas, input)

    // Les modèles sont chargés à part : MediaPipe ne doit pas retarder l'affichage du miroir.
    async function startFace(engine: MirrorEngine, scheduler: TrackingScheduler) {
      try {
        const { FaceTracker } = await import('../lib/tracking/face')
        faceTracker = await FaceTracker.create()
      } catch (err) {
        console.error(err)
        if (!disposed) faceStatus = { name: 'error' }
        return
      }
      if (disposed) return faceTracker.close()
      faceInput = new FaceBreathInput(
        faceTracker,
        video,
        input,
        () => engine.coverTransform,
        () => canvas.width / canvas.height,
        faceParams,
        (debug) => {
          if (showDebug) faceDebug = debug
        },
      )
      scheduler.add(faceInput)
      faceStatus = { name: 'ready', delegate: faceTracker.delegate }
    }

    async function startHand(engine: MirrorEngine, scheduler: TrackingScheduler) {
      try {
        const { HandTracker } = await import('../lib/tracking/hand')
        handTracker = await HandTracker.create()
      } catch (err) {
        console.error(err)
        if (!disposed) handStatus = { name: 'error' }
        return
      }
      if (disposed) return handTracker.close()
      handInput = new HandStrokeInput(handTracker, video, input, {
        getCover: () => engine.coverTransform,
        pointingParams,
        filterParams,
        onCursor: (cursor) => (handCursor = cursor),
        onDebug: (debug) => {
          if (showDebug) handDebug = debug
        },
      })
      scheduler.add(handInput)
      handStatus = { name: 'ready', delegate: handTracker.delegate }
    }

    video.srcObject = stream
    video
      .play()
      .then(() => {
        if (disposed) return
        try {
          // ?r8 dans l'URL force le format 8 bits du champ, pour tester le repli.
          const forceR8 = new URLSearchParams(location.search).has('r8')
          engine = new MirrorEngine(canvas, video, input, params, {
            fieldFormat: forceR8 ? 'R8' : undefined,
          })
        } catch (err) {
          console.error(err)
          onerror('webgl')
          return
        }
        engine.start()
        scheduler = new TrackingScheduler(video, schedulerParams)
        scheduler.start()
        startFace(engine, scheduler)
        startHand(engine, scheduler)
      })
      .catch((err) => {
        console.error(err)
        if (!disposed) onerror('unknown')
      })

    const statsTimer = setInterval(() => {
      if (engine) stats = engine.stats
      if (scheduler) taskStats = { face: scheduler.stats('face'), hand: scheduler.stats('hand') }
    }, 500)

    return () => {
      disposed = true
      clearInterval(statsTimer)
      detachPointer()
      track?.removeEventListener('ended', onEnded)
      scheduler?.stop()
      faceInput?.dispose()
      handInput?.dispose()
      faceTracker?.close()
      handTracker?.close()
      engine?.dispose()
      engine = undefined
      video.srcObject = null
    }
  })

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'd') showDebug = !showDebug
    else if (e.key === 'e') engine?.fillFog(1)
    else if (e.key === 'c') engine?.fillFog(0)
  }
</script>

<svelte:window {onkeydown} />

<!-- La vidéo n'est pas affichée : elle sert de source à la texture WebGL. -->
<video bind:this={video} muted playsinline aria-hidden="true"></video>
<canvas bind:this={canvas} aria-label="Miroir"></canvas>

{#if handCursor}
  <HandCursorView cursor={handCursor} diameter={params.strokeRadius * 2} />
{/if}

<p class="hint">
  {#if faceStatus.name === 'loading' || handStatus.name === 'loading'}
    Chargement du suivi du visage et de la main…
  {:else}
    {faceStatus.name === 'ready'
      ? 'Ouvrez la bouche pour souffler'
      : 'Maintenir le clic : souffler'} · {handStatus.name === 'ready'
      ? 'Tendez l’index pour écrire'
      : 'Clic droit ou Maj + glisser : écrire'} · E / C : tout embuer / effacer
  {/if}
</p>

{#if showDebug}
  <TrackingOverlay face={faceDebug} hand={handDebug} />
  <DebugOverlay
    {stats}
    {faceStatus}
    {faceDebug}
    {faceParams}
    {handStatus}
    {handDebug}
    {pointingParams}
    {taskStats}
  />
  <DevPanel fog={params} groups={paramGroups} onfill={(d) => engine?.fillFog(d)} />
{/if}

<style>
  video {
    position: fixed;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
    touch-action: none;
  }

  .hint {
    position: fixed;
    bottom: 16px;
    left: 50%;
    max-width: calc(100% - 32px);
    margin: 0;
    padding: 6px 14px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.45);
    color: rgb(255 255 255 / 0.85);
    font-size: 0.8rem;
    text-align: center;
    pointer-events: none;
  }
</style>
