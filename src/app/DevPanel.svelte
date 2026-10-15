<script lang="ts">
  import { onMount } from 'svelte'
  import type { FolderApi } from 'tweakpane'
  import type { FogParams } from '../lib/fog/params'
  import type { ParamGroup } from '../lib/param-spec'

  interface Props {
    /** Paramètres de la buée : leur couleur a un contrôle à part. */
    fog: FogParams
    groups: ParamGroup<object>[]
    onfill: (density: number) => void
  }

  let { fog, groups, onfill }: Props = $props()
  let container: HTMLDivElement

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
        for (const g of groups) Object.assign(g.target, structuredClone(g.defaults))
        pane.refresh()
      })
      actions.addButton({ title: 'Copier les réglages (JSON)' }).on('click', () => {
        const all = Object.assign({}, ...groups.map((g) => g.target))
        navigator.clipboard?.writeText(JSON.stringify(all, null, 2))
      })

      const folders: Record<string, FolderApi> = {}
      for (const { target, specs } of groups) {
        for (const spec of specs) {
          const folder = (folders[spec.folder] ??= pane.addFolder({ title: spec.folder }))
          folder.addBinding(target, spec.key as keyof typeof target, {
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
