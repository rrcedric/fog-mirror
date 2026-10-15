<script lang="ts">
  import { ERROR_MESSAGES, type AppErrorKind } from './messages'

  interface Props {
    kind: AppErrorKind
    onretry: () => void
  }

  let { kind, onretry }: Props = $props()
  let message = $derived(ERROR_MESSAGES[kind])
</script>

<main class="screen">
  <div class="card" role="alert">
    <h1>{message.title}</h1>
    <p class="lead">{message.detail}</p>
    {#if kind !== 'insecure' && kind !== 'unsupported' && kind !== 'webgl'}
      <button onclick={onretry}>Réessayer</button>
    {/if}
  </div>
</main>
