<script lang="ts">
  import type { HandCursor } from '../lib/input/hand-stroke'

  interface Props {
    cursor: HandCursor
    /** Diamètre du trait, en fraction de la hauteur de l'écran. */
    diameter: number
  }

  let { cursor, diameter }: Props = $props()
</script>

<!-- L'écran n'est pas touché : ce repère montre où écrit l'index, et s'il écrit. -->
<div
  class="cursor"
  class:drawing={cursor.drawing}
  style:left="{cursor.position.x * 100}%"
  style:top="{cursor.position.y * 100}%"
  style:--size="{diameter * 100}vh"
  aria-hidden="true"
></div>

<style>
  .cursor {
    position: fixed;
    width: max(var(--size), 14px);
    height: max(var(--size), 14px);
    border: 2px solid rgb(255 255 255 / 0.7);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 6px rgb(0 0 0 / 0.35);
    pointer-events: none;
    transition:
      left 40ms linear,
      top 40ms linear,
      background-color 120ms,
      border-color 120ms;
  }

  .cursor.drawing {
    border-color: #fff;
    background: rgb(255 255 255 / 0.35);
  }
</style>
