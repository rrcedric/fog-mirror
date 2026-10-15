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
  import {
    DEFAULT_OPEN_PALM_PARAMS,
    DEFAULT_POINTING_PARAMS,
    POINTING_PARAM_SPECS,
  } from '../lib/tracking/gesture'
  import type { HandTracker } from '../lib/tracking/hand'
  import {
    DEFAULT_SCHEDULER_PARAMS,
    SCHEDULER_PARAM_SPECS,
    TrackingScheduler,
    type TaskStats,
  } from '../lib/tracking/scheduler'
  import { QualityGovernor } from '../lib/perf/quality'
  import {
    fullscreenSupported,
    isFullscreen,
    onFullscreenChange,
    toggleFullscreen,
  } from '../lib/ui/fullscreen'
  import { loadJson, saveJson } from '../lib/ui/storage'
  import Coach from './Coach.svelte'
  import DebugOverlay from './DebugOverlay.svelte'
  import DevPanel from './DevPanel.svelte'
  import HandCursorView from './HandCursor.svelte'
  import HelpPanel from './HelpPanel.svelte'
  import SettingsPanel from './SettingsPanel.svelte'
  import Toolbar from './Toolbar.svelte'
  import TrackingOverlay from './TrackingOverlay.svelte'
  import type { AppErrorKind } from './messages'
  import { advance, type OnboardingEvent, type OnboardingStep } from './onboarding'
  import type { TrackerStatus } from './tracking-status'
  import { applyStoredSettings } from './user-settings'

  interface Props {
    stream: MediaStream
    onerror: (kind: AppErrorKind) => void
  }

  let { stream, onerror }: Props = $props()

  // Objets simples (non réactifs) : lus en continu par le moteur et le suivi, modifiés par le panneau.
  const params = createParams()
  applyStoredSettings(params)
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
  // Overlay de debug et panneau de réglages complets : touche D (ou ?debug dans l'URL).
  let showDebug = $state(new URLSearchParams(location.search).has('debug'))
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

  // Guide d'accueil : affiché tant qu'il n'a pas été terminé ou passé une fois.
  let onboarding = $state<OnboardingStep>(loadJson('onboarded', false) ? 'done' : 'breathe')
  let breathSeconds = 0
  let strokeLength = 0
  let panel = $state<'none' | 'settings' | 'help'>('none')
  let fullscreen = $state(isFullscreen())
  let idle = $state(false)
  let toast = $state<string | null>(null)
  let flash = $state(false)
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const governor = new QualityGovernor()

  let faceAvailable = $derived(faceStatus.name !== 'error')
  let handAvailable = $derived(handStatus.name !== 'error')
  let trackingLoading = $derived(faceStatus.name === 'loading' || handStatus.name === 'loading')

  function onboard(event: OnboardingEvent) {
    if (onboarding === 'done') return
    onboarding = advance(onboarding, event)
    if (onboarding === 'done') saveJson('onboarded', true)
  }

  // Il faut souffler environ une demi-seconde et écrire un trait d'un cinquième d'écran pour
  // valider une étape : un geste fugace ne compte pas.
  function noteBreath(seconds: number) {
    breathSeconds += seconds
    if (breathSeconds >= 0.6) onboard('breathed')
  }

  function noteStroke(length: number) {
    strokeLength += length
    if (strokeLength >= 0.2) onboard('wrote')
  }

  function showToast(message: string) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 2200)
  }

  function wipe() {
    engine?.wipeAll()
    onboard('cleared')
  }

  async function capture() {
    const blob = await engine?.capture()
    if (!blob) return showToast('Impossible d’enregistrer l’image')
    flash = true
    setTimeout(() => (flash = false), 180)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
    a.href = url
    a.download = `fog-mirror-${stamp}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('Image enregistrée')
  }

  function togglePanel(name: 'settings' | 'help') {
    panel = panel === name ? 'none' : name
  }

  function replayOnboarding() {
    panel = 'none'
    breathSeconds = 0
    strokeLength = 0
    onboarding = 'breathe'
  }

  // L'interface s'estompe quand la souris ne bouge plus, pour laisser toute la place au miroir.
  function wake() {
    idle = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => (idle = true), 3000)
  }

  onMount(() => {
    let disposed = false
    let faceTracker: FaceTracker | undefined
    let handTracker: HandTracker | undefined
    let faceInput: FaceBreathInput | undefined
    let handInput: HandStrokeInput | undefined
    const track = stream.getVideoTracks()[0]
    const onEnded = () => onerror('ended')
    track?.addEventListener('ended', onEnded)
    const detachPointer = attachPointerInput(canvas, input, (kind, amount) =>
      kind === 'breath' ? noteBreath(amount) : noteStroke(amount),
    )
    const detachFullscreen = onFullscreenChange(() => (fullscreen = isFullscreen()))
    wake()

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
          if (debug.breath.active) noteBreath(1 / Math.max(debug.detectFps, 10))
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
        openPalmParams: { ...DEFAULT_OPEN_PALM_PARAMS },
        filterParams,
        onClear: wipe,
        onCursor: (cursor) => {
          if (cursor?.drawing && handCursor?.drawing) {
            noteStroke(
              Math.hypot(
                cursor.position.x - handCursor.position.x,
                cursor.position.y - handCursor.position.y,
              ),
            )
          }
          handCursor = cursor
        },
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
            fieldFormat: forceR8 ? 'RG8' : undefined,
          })
        } catch (err) {
          console.error(err)
          onerror('webgl')
          return
        }
        engine.start()
        // En développement, le moteur est accessible depuis la console (tests, réglages).
        if (import.meta.env.DEV) Object.assign(window, { __engine: engine })
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
      if (engine) {
        stats = engine.stats
        // Qualité adaptative. Quand le navigateur suspend la page (onglet caché, fenêtre masquée),
        // l'affichage tombe à quelques images par seconde : ce n'est pas un manque de puissance,
        // on ignore ces mesures. Une vraie surcharge descend rarement sous 8 images/s.
        const pageRunning = stats.renderFps >= 8
        if (!document.hidden && pageRunning) {
          const quality = governor.update(stats.renderFps, 0.5)
          if (quality) engine.setQuality(quality)
        }
      }
      if (scheduler) taskStats = { face: scheduler.stats('face'), hand: scheduler.stats('hand') }
    }, 500)

    return () => {
      disposed = true
      clearInterval(statsTimer)
      clearTimeout(toastTimer)
      clearTimeout(idleTimer)
      detachPointer()
      detachFullscreen()
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
    if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
    wake()
    const key = e.key.toLowerCase()
    if (key === 'escape') panel = 'none'
    else if (key === 'd') showDebug = !showDebug
    else if (key === 'e') engine?.fillFog(1)
    else if (key === 'c') wipe()
    else if (key === 's') capture()
    else if (key === 'f') toggleFullscreen()
    else if (key === 'h' || key === '?') togglePanel('help')
  }
</script>

<svelte:window {onkeydown} onpointermove={wake} />

<!-- La vidéo n'est pas affichée : elle sert de source à la texture WebGL. -->
<video bind:this={video} muted playsinline aria-hidden="true"></video>
<canvas bind:this={canvas} aria-label="Miroir"></canvas>

{#if handCursor}
  <HandCursorView cursor={handCursor} diameter={params.strokeRadius * 2} />
{/if}

{#if flash}
  <div class="flash" aria-hidden="true"></div>
{/if}

<div class="guide">
  {#if trackingLoading}
    <p class="pill">Préparation du suivi du visage et de la main…</p>
  {/if}
  {#if onboarding !== 'done'}
    <Coach
      step={onboarding}
      {faceAvailable}
      {handAvailable}
      onnext={() => onboard('next')}
      onskip={() => onboard('skip')}
    />
  {/if}
</div>

<div class="side" class:idle={idle && panel === 'none'}>
  {#if panel !== 'none'}
    <div class="popover">
      {#if panel === 'settings'}
        <SettingsPanel {params} />
      {:else}
        <HelpPanel {faceAvailable} {handAvailable} onreplay={replayOnboarding} />
      {/if}
    </div>
  {/if}
  <Toolbar
    {fullscreen}
    fullscreenAvailable={fullscreenSupported()}
    {panel}
    onwipe={wipe}
    oncapture={capture}
    onfullscreen={toggleFullscreen}
    onpanel={togglePanel}
  />
</div>

{#if toast}
  <p class="toast" role="status">{toast}</p>
{/if}

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

  /* Guide d'accueil : centré en bas de l'écran. */
  .guide {
    position: fixed;
    bottom: 16px;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transform: translateX(-50%);
  }

  /* Barre d'outils : en bas à droite, estompée quand la souris ne bouge plus. */
  .side {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    transition: opacity 400ms;
  }

  .side.idle {
    opacity: 0.3;
  }

  .popover {
    width: min(300px, calc(100vw - 32px));
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding: 16px;
    border: 1px solid var(--card-border);
    border-radius: 16px;
    background: rgb(12 14 18 / 0.72);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    color: var(--fg);
  }

  .pill {
    margin: 0;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.5);
    color: rgb(255 255 255 / 0.85);
    font-size: 0.8rem;
  }

  .toast {
    position: fixed;
    top: 16px;
    left: 50%;
    margin: 0;
    padding: 8px 16px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: rgb(12 14 18 / 0.75);
    color: var(--fg);
    font-size: 0.875rem;
    pointer-events: none;
  }

  .flash {
    position: fixed;
    inset: 0;
    background: #fff;
    opacity: 0.6;
    pointer-events: none;
    animation: flash 180ms ease-out forwards;
  }

  @keyframes flash {
    to {
      opacity: 0;
    }
  }

  /* Écran étroit : le guide passe au-dessus de la barre d'outils. */
  @media (max-width: 720px) {
    .guide {
      bottom: 80px;
    }

    .side {
      right: 50%;
      align-items: center;
      transform: translateX(50%);
    }
  }
</style>
