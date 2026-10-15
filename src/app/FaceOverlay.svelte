<script lang="ts">
  import type { FaceBreathDebug } from '../lib/input/face-breath'

  interface Props {
    debug: FaceBreathDebug
  }

  let { debug }: Props = $props()
  let lips = $derived(debug.face?.innerLips.map((p) => `${p.x},${p.y}`).join(' ') ?? '')
</script>

<!-- Repère normalisé 0..1 étiré sur l'écran, comme les coordonnées « écran » de coords.ts. -->
<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
  {#if debug.face}
    {@const m = debug.face.mouth}
    <g class:active={debug.breath.active}>
      <polygon points={lips} />
      <line x1={m.x - 0.015} y1={m.y} x2={m.x + 0.015} y2={m.y} />
      <line x1={m.x} y1={m.y - 0.02} x2={m.x} y2={m.y + 0.02} />
    </g>
  {/if}
</svg>

<style>
  svg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  g {
    fill: none;
    stroke: rgb(255 255 255 / 0.8);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  g * {
    vector-effect: non-scaling-stroke;
  }

  g.active {
    stroke: #6ee7a8;
  }
</style>
