<script lang="ts">
  interface Props {
    requesting: boolean
    onstart: () => void
  }

  let { requesting, onstart }: Props = $props()
</script>

<main class="screen">
  <div class="card">
    <h1>Fog Mirror</h1>
    <p class="lead">Soufflez sur le miroir, puis écrivez dans la buée.</p>
    <button onclick={onstart} disabled={requesting}>
      {requesting ? 'En attente de l’autorisation…' : 'Activer la caméra'}
    </button>
    <p class="note">
      Tout reste sur votre appareil : aucune image n’est envoyée.
      <a href="./confidentialite.html">Confidentialité</a>
    </p>
  </div>
</main>
