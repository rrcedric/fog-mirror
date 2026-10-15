<script lang="ts">
  import type { FogParams } from '../lib/fog/params'
  import { resetSettings, saveSettings, USER_SETTINGS } from './user-settings'

  interface Props {
    params: FogParams
  }

  let { params }: Props = $props()

  // Copie réactive des valeurs : `params` est un objet simple, lu par le moteur à chaque frame.
  let values = $state(Object.fromEntries(USER_SETTINGS.map((s) => [s.key, params[s.key]])))

  function set(key: (typeof USER_SETTINGS)[number]['key'], value: number) {
    params[key] = value
    values[key] = value
    saveSettings(params)
  }

  function reset() {
    resetSettings(params)
    for (const s of USER_SETTINGS) values[s.key] = params[s.key]
  }
</script>

<section class="panel" aria-label="Réglages">
  {#each USER_SETTINGS as s (s.key)}
    <label>
      <span class="label">{s.label}</span>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={values[s.key]}
        oninput={(e) => set(s.key, Number(e.currentTarget.value))}
      />
      <span class="ends"><span>{s.ends[0]}</span><span>{s.ends[1]}</span></span>
    </label>
  {/each}
  <button onclick={reset}>Valeurs par défaut</button>
</section>

<style>
  label {
    display: block;
    margin-bottom: 14px;
  }

  .label {
    display: block;
    margin-bottom: 4px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  input {
    width: 100%;
    accent-color: var(--accent);
  }

  .ends {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--muted);
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
