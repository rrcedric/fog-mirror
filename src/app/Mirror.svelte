<script lang="ts">
  import { onMount } from 'svelte'
  import { MirrorEngine, type EngineStats } from '../lib/fog/engine'
  import { createParams } from '../lib/fog/params'
  import { InputBus } from '../lib/input/events'
  import { attachPointerInput } from '../lib/input/pointer'
  import DebugOverlay from './DebugOverlay.svelte'
  import DevPanel from './DevPanel.svelte'
  import type { AppErrorKind } from './messages'

  interface Props {
    stream: MediaStream
    onerror: (kind: AppErrorKind) => void
  }

  let { stream, onerror }: Props = $props()

  // Objet simple (non réactif) : lu à chaque frame par le moteur, modifié par le panneau.
  const params = createParams()
  const input = new InputBus()

  let canvas: HTMLCanvasElement
  let video: HTMLVideoElement
  let engine: MirrorEngine | undefined
  let showDebug = $state(import.meta.env.DEV)
  let stats = $state<EngineStats | null>(null)

  onMount(() => {
    let disposed = false
    const track = stream.getVideoTracks()[0]
    const onEnded = () => onerror('ended')
    track?.addEventListener('ended', onEnded)
    const detachPointer = attachPointerInput(canvas, input)

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
  Maintenir le clic : souffler · Clic droit ou Maj + glisser : écrire · E : tout embuer · C : tout
  effacer
</p>

{#if showDebug}
  <DebugOverlay {stats} />
  <DevPanel {params} onfill={(d) => engine?.fillFog(d)} />
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
