<script lang="ts">
  import { onMount } from 'svelte'
  import { MirrorEngine, type EngineStats } from '../lib/fog/engine'
  import DebugOverlay from './DebugOverlay.svelte'
  import type { AppErrorKind } from './messages'

  interface Props {
    stream: MediaStream
    onerror: (kind: AppErrorKind) => void
  }

  let { stream, onerror }: Props = $props()

  let canvas: HTMLCanvasElement
  let video: HTMLVideoElement
  let showDebug = $state(import.meta.env.DEV)
  let stats = $state<EngineStats | null>(null)

  onMount(() => {
    let engine: MirrorEngine | undefined
    let disposed = false
    const track = stream.getVideoTracks()[0]
    const onEnded = () => onerror('ended')
    track?.addEventListener('ended', onEnded)

    video.srcObject = stream
    video
      .play()
      .then(() => {
        if (disposed) return
        try {
          engine = new MirrorEngine(canvas, video)
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
      track?.removeEventListener('ended', onEnded)
      engine?.dispose()
      video.srcObject = null
    }
  })

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) showDebug = !showDebug
  }
</script>

<svelte:window {onkeydown} />

<!-- La vidéo n'est pas affichée : elle sert de source à la texture WebGL. -->
<video bind:this={video} muted playsinline aria-hidden="true"></video>
<canvas bind:this={canvas} aria-label="Miroir"></canvas>

{#if showDebug}
  <DebugOverlay {stats} />
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
  }
</style>
