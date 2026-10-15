<script lang="ts">
  import type { EngineStats } from '../lib/fog/engine'

  interface Props {
    stats: EngineStats | null
  }

  let { stats }: Props = $props()
</script>

<aside>
  {#if stats}
    <div>rendu <b>{stats.renderFps.toFixed(0)}</b> fps</div>
    <div>caméra <b>{stats.cameraFps > 0 ? stats.cameraFps.toFixed(0) : '—'}</b> fps</div>
    <div>vidéo {stats.videoSize[0]}×{stats.videoSize[1]}</div>
    <div>canvas {stats.canvasSize[0]}×{stats.canvasSize[1]}</div>
  {:else}
    <div>démarrage…</div>
  {/if}
  <div class="hint">D : masquer</div>
</aside>

<style>
  aside {
    position: fixed;
    top: 12px;
    left: 12px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.55);
    color: #e6e6e6;
    font:
      12px/1.5 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  b {
    color: #fff;
  }

  .hint {
    margin-top: 4px;
    color: #9a9a9a;
  }
</style>
