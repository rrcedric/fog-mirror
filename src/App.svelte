<script lang="ts">
  import { onDestroy } from 'svelte'
  import ErrorScreen from './app/ErrorScreen.svelte'
  import Mirror from './app/Mirror.svelte'
  import Welcome from './app/Welcome.svelte'
  import type { AppErrorKind } from './app/messages'
  import { classifyCameraError, closeCamera, openCamera } from './lib/camera/camera'

  type Phase =
    | { name: 'welcome' }
    | { name: 'requesting' }
    | { name: 'running'; stream: MediaStream }
    | { name: 'error'; kind: AppErrorKind }

  let phase = $state<Phase>({ name: 'welcome' })

  async function start() {
    phase = { name: 'requesting' }
    try {
      phase = { name: 'running', stream: await openCamera() }
    } catch (err) {
      console.error(err)
      phase = { name: 'error', kind: classifyCameraError(err) }
    }
  }

  function fail(kind: AppErrorKind) {
    if (phase.name === 'running') closeCamera(phase.stream)
    phase = { name: 'error', kind }
  }

  onDestroy(() => {
    if (phase.name === 'running') closeCamera(phase.stream)
  })
</script>

{#if phase.name === 'running'}
  <Mirror stream={phase.stream} onerror={fail} />
{:else if phase.name === 'error'}
  <ErrorScreen kind={phase.kind} onretry={start} />
{:else}
  <Welcome requesting={phase.name === 'requesting'} onstart={start} />
{/if}
