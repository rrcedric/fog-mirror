<script lang="ts">
  interface Props {
    faceAvailable: boolean
    handAvailable: boolean
    onreplay: () => void
  }

  let { faceAvailable, handAvailable, onreplay }: Props = $props()
</script>

<section class="panel" aria-label="Aide">
  <h2>Gestes</h2>
  <dl>
    {#if faceAvailable}
      <dt>Souffler</dt>
      <dd>Bouche ouverte face à la caméra</dd>
    {/if}
    {#if handAvailable}
      <dt>Écrire</dt>
      <dd>Index tendu, autres doigts repliés</dd>
      <dt>Tout effacer</dt>
      <dd>Main ouverte pendant une seconde</dd>
    {/if}
    <dt>Souris</dt>
    <dd>Clic maintenu : souffler · Clic droit glissé : écrire</dd>
  </dl>
  <h2>Raccourcis</h2>
  <dl class="keys">
    <dt><kbd>C</kbd></dt>
    <dd>Tout effacer</dd>
    <dt><kbd>E</kbd></dt>
    <dd>Tout embuer</dd>
    <dt><kbd>S</kbd></dt>
    <dd>Enregistrer une image</dd>
    <dt><kbd>F</kbd></dt>
    <dd>Plein écran</dd>
    <dt><kbd>H</kbd></dt>
    <dd>Aide</dd>
  </dl>
  <div class="footer">
    <button onclick={onreplay}>Revoir le guide</button>
    <a href="./confidentialite.html" target="_blank" rel="noopener">Confidentialité</a>
  </div>
</section>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 0 0 16px;
    font-size: 0.875rem;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
    color: var(--fg);
  }

  kbd {
    display: inline-block;
    min-width: 22px;
    padding: 1px 6px;
    border: 1px solid var(--card-border);
    border-radius: 6px;
    font: inherit;
    font-size: 0.8rem;
    text-align: center;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  a {
    color: var(--muted);
    font-size: 0.875rem;
  }

  button {
    padding: 8px 14px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }

  button:hover {
    background: rgb(255 255 255 / 0.1);
  }
</style>
