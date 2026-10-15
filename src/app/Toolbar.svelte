<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    fullscreen: boolean
    fullscreenAvailable: boolean
    panel: 'none' | 'settings' | 'help'
    onwipe: () => void
    oncapture: () => void
    onfullscreen: () => void
    onpanel: (panel: 'settings' | 'help') => void
  }

  let { fullscreen, fullscreenAvailable, panel, onwipe, oncapture, onfullscreen, onpanel }: Props =
    $props()
</script>

<nav class="toolbar" aria-label="Actions du miroir">
  <button onclick={onwipe} title="Tout effacer (C)" aria-label="Tout effacer">
    <Icon name="wipe" />
  </button>
  <button onclick={oncapture} title="Enregistrer une image (S)" aria-label="Enregistrer une image">
    <Icon name="camera" />
  </button>
  {#if fullscreenAvailable}
    <button
      onclick={onfullscreen}
      title={fullscreen ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}
      aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
    >
      <Icon name={fullscreen ? 'shrink' : 'expand'} />
    </button>
  {/if}
  <button
    onclick={() => onpanel('settings')}
    class:active={panel === 'settings'}
    title="Réglages"
    aria-label="Réglages"
    aria-expanded={panel === 'settings'}
  >
    <Icon name="sliders" />
  </button>
  <button
    onclick={() => onpanel('help')}
    class:active={panel === 'help'}
    title="Aide (H)"
    aria-label="Aide"
    aria-expanded={panel === 'help'}
  >
    <Icon name="help" />
  </button>
</nav>

<style>
  .toolbar {
    display: flex;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: rgb(12 14 18 / 0.55);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }

  button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--fg);
    cursor: pointer;
  }

  button:hover,
  button.active {
    background: rgb(255 255 255 / 0.14);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
