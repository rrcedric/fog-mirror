<script lang="ts">
  import type { FaceBreathDebug } from '../lib/input/face-breath'
  import type { HandStrokeDebug } from '../lib/input/hand-stroke'
  import { HAND_BONES } from '../lib/tracking/hand-landmarks'

  interface Props {
    face: FaceBreathDebug | null
    hand: HandStrokeDebug | null
  }

  let { face, hand }: Props = $props()
  let lips = $derived(face?.face?.innerLips.map((p) => `${p.x},${p.y}`).join(' ') ?? '')
</script>

<!-- Repère normalisé 0..1 étiré sur l'écran, comme les coordonnées « écran » de coords.ts. -->
<svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
  {#if face?.face}
    {@const m = face.face.mouth}
    <g class:active={face.breath.active}>
      <polygon points={lips} />
      <line x1={m.x - 0.015} y1={m.y} x2={m.x + 0.015} y2={m.y} />
      <line x1={m.x} y1={m.y - 0.02} x2={m.x} y2={m.y + 0.02} />
    </g>
  {/if}
  {#if hand?.landmarks}
    {@const pts = hand.landmarks}
    <g class:active={hand.drawing}>
      {#each HAND_BONES as [a, b] (`${a}-${b}`)}
        <line x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
      {/each}
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
  }

  g * {
    vector-effect: non-scaling-stroke;
  }

  g.active {
    stroke: #6ee7a8;
  }
</style>
