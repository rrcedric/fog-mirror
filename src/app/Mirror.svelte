<script lang="ts">
  import { onMount } from 'svelte'
  import { MirrorEngine, type EngineStats } from '../lib/fog/engine'
  import { createParams } from '../lib/fog/params'
  import { InputBus } from '../lib/input/events'
  import { FaceBreathInput, type FaceBreathDebug } from '../lib/input/face-breath'
  import { attachPointerInput } from '../lib/input/pointer'
  import { DEFAULT_BREATH_SHAPE_PARAMS } from '../lib/tracking/breath-shape'
  import type { FaceTracker } from '../lib/tracking/face'
  import DebugOverlay from './DebugOverlay.svelte'
  import DevPanel from './DevPanel.svelte'
  import FaceOverlay from './FaceOverlay.svelte'
  import type { FaceStatus } from './face-status'
  import type { AppErrorKind } from './messages'

  interface Props {
    stream: MediaStream
    onerror: (kind: AppErrorKind) => void
  }

  let { stream, onerror }: Props = $props()

  // Objets simples (non réactifs) : lus en continu par le moteur, modifiés par le panneau.
  const params = createParams()
  const faceParams = { ...DEFAULT_BREATH_SHAPE_PARAMS }
  const input = new InputBus()

  let canvas: HTMLCanvasElement
  let video: HTMLVideoElement
  let engine: MirrorEngine | undefined
  let showDebug = $state(import.meta.env.DEV)
  let stats = $state<EngineStats | null>(null)
  let faceStatus = $state<FaceStatus>({ name: 'loading' })
  let faceDebug = $state<FaceBreathDebug | null>(null)

  onMount(() => {
    let disposed = false
    let tracker: FaceTracker | undefined
    let faceInput: FaceBreathInput | undefined
    const track = stream.getVideoTracks()[0]
    const onEnded = () => onerror('ended')
    track?.addEventListener('ended', onEnded)
    const detachPointer = attachPointerInput(canvas, input)

    async function startFaceTracking(engine: MirrorEngine) {
      try {
        // Chargé à part : MediaPipe ne doit pas retarder l'affichage du miroir.
        const { FaceTracker } = await import('../lib/tracking/face')
        tracker = await FaceTracker.create()
      } catch (err) {
        console.error(err)
        if (!disposed) faceStatus = { name: 'error' }
        return
      }
      if (disposed) {
        tracker.close()
        return
      }
      faceInput = new FaceBreathInput(
        tracker,
        video,
        input,
        () => engine.coverTransform,
        () => canvas.width / canvas.height,
        faceParams,
        (debug) => {
          if (showDebug) faceDebug = debug
        },
      )
      faceInput.start()
      faceStatus = { name: 'ready', delegate: tracker.delegate }
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
        startFaceTracking(engine)
      })
      .catch((err) => {
        console.error(err)
        if (!disposed) onerror('unknown')
      })

    const statsTimer = setInterval(() => {
      if (engine) stats = engine.stats
    }, 500)

    return () => {
      disposed = true
      clearInterval(statsTimer)
      detachPointer()
      track?.removeEventListener('ended', onEnded)
      faceInput?.stop()
      tracker?.close()
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

<p class="hint">
  {#if faceStatus.name === 'ready'}
    Ouvrez la bouche comme pour souffler sur le miroir · Clic droit ou Maj + glisser : écrire · E /
    C : tout embuer / effacer
  {:else if faceStatus.name === 'loading'}
    Chargement de la détection du visage…
  {:else}
    Détection du visage indisponible · Maintenir le clic : souffler · Clic droit ou Maj + glisser :
    écrire
  {/if}
</p>

{#if showDebug}
  {#if faceDebug}
    <FaceOverlay debug={faceDebug} />
  {/if}
  <DebugOverlay {stats} {faceStatus} {faceDebug} {faceParams} />
  <DevPanel fog={params} face={faceParams} onfill={(d) => engine?.fillFog(d)} />
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
