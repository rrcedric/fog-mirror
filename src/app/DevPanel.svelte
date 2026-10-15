<script lang="ts">
  import { onMount } from 'svelte'
  import type { FolderApi, Pane } from 'tweakpane'
  import { FOG_PARAM_SPECS, resetParams, type FogParams } from '../lib/fog/params'
  import type { ParamSpec } from '../lib/param-spec'
  import {
    BREATH_SHAPE_PARAM_SPECS,
    DEFAULT_BREATH_SHAPE_PARAMS,
    type BreathShapeParams,
  } from '../lib/tracking/breath-shape'

  interface Props {
    fog: FogParams
    face: BreathShapeParams
    onfill: (density: number) => void
  }

  let { fog, face, onfill }: Props = $props()
  let container: HTMLDivElement

  function addBindings<T extends object>(
    pane: Pane,
    folders: Record<string, FolderApi>,
    target: T,
    specs: ParamSpec<T>[],
  ) {
    for (const spec of specs) {
      const folder = (folders[spec.folder] ??= pane.addFolder({ title: spec.folder }))
      folder.addBinding(target, spec.key, {
        label: spec.label,
        min: spec.min,
        max: spec.max,
        step: spec.step,
      })
      if (target === fog && spec.key === 'veilOpacity') {
        folder.addBinding(fog, 'fogColor', { label: 'couleur', color: { type: 'float' } })
      }
    }
  }

  onMount(() => {
    let disposed = false
    let dispose = () => {}

    // Chargé à la demande : Tweakpane ne sert qu'au réglage.
    import('tweakpane').then(({ Pane }) => {
      if (disposed) return
      const pane = new Pane({ container, title: 'Réglages' })
      dispose = () => pane.dispose()

      const actions = pane.addFolder({ title: 'Actions' })
      actions.addButton({ title: 'Tout embuer' }).on('click', () => onfill(1))
      actions.addButton({ title: 'Tout effacer' }).on('click', () => onfill(0))
      actions.addButton({ title: 'Valeurs par défaut' }).on('click', () => {
        resetParams(fog)
        Object.assign(face, DEFAULT_BREATH_SHAPE_PARAMS)
        pane.refresh()
      })
      actions.addButton({ title: 'Copier les réglages (JSON)' }).on('click', () => {
        navigator.clipboard?.writeText(JSON.stringify({ fog, face }, null, 2))
      })

      const folders: Record<string, FolderApi> = {}
      addBindings(pane, folders, face, BREATH_SHAPE_PARAM_SPECS)
      addBindings(pane, folders, fog, FOG_PARAM_SPECS)
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
