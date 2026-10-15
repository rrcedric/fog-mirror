<script lang="ts">
  export type IconName = 'wipe' | 'camera' | 'expand' | 'shrink' | 'sliders' | 'help' | 'close'

  interface Props {
    name: IconName
  }

  let { name }: Props = $props()
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  {#if name === 'wipe'}
    <path d="M4 15c3-1 5 1 8 0s5-3 8-2" />
    <path d="M4 10c3-1 5 1 8 0s5-3 8-2" />
    <path d="M4 20h16" />
  {:else if name === 'camera'}
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  {:else if name === 'expand'}
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  {:else if name === 'shrink'}
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  {:else if name === 'sliders'}
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  {:else if name === 'help'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
    <path d="M12 16.5v.5" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {/if}
</svg>

<style>
  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
