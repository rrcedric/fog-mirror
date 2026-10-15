<script lang="ts">
  import { onMount } from 'svelte'
  import { PARAM_SPECS, resetParams, type FogParams } from '../lib/fog/params'

  interface Props {
    params: FogParams
    onfill: (density: number) => void
  }

  let { params, onfill }: Props = $props()
  let container: HTMLDivElement

  onMount(() => {
    let disposed = false
    let dispose = () => {}

    // Chargé à la demande : Tweakpane ne sert qu'au réglage.
    import('tweakpane').then(({ Pane }) => {
      if (disposed) return
      const pane = new Pane({ container, title: 'Réglages de la buée' })
      dispose = () => pane.dispose()

      const actions = pane.addFolder({ title: 'Actions' })
      actions.addButton({ title: 'Tout embuer' }).on('click', () => onfill(1))
      actions.addButton({ title: 'Tout effacer' }).on('click', () => onfill(0))
      actions.addButton({ title: 'Valeurs par défaut' }).on('click', () => {
        resetParams(params)
        pane.refresh()
      })
      actions.addButton({ title: 'Copier les réglages (JSON)' }).on('click', () => {
        navigator.clipboard?.writeText(JSON.stringify(params, null, 2))
      })

      const folders: Record<string, ReturnType<typeof pane.addFolder>> = {}
      for (const spec of PARAM_SPECS) {
        const folder = (folders[spec.folder] ??= pane.addFolder({ title: spec.folder }))
        folder.addBinding(params, spec.key, {
          label: spec.label,
          min: spec.min,
          max: spec.max,
          step: spec.step,
        })
        if (spec.key === 'veilOpacity') {
          folder.addBinding(params, 'fogColor', { label: 'couleur', color: { type: 'float' } })
        }
      }
    })

    return () => {
      disposed = true
      dispose()
    }
  })
</script>

<div bind:this={container} class="panel"></div>

<style>
  .panel {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 300px;
    max-height: calc(100% - 24px);
    overflow-y: auto;
  }
</style>
