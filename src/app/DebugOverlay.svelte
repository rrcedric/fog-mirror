<script lang="ts">
  import type { EngineStats } from '../lib/fog/engine'
  import type { FaceBreathDebug } from '../lib/input/face-breath'
  import type { HandStrokeDebug } from '../lib/input/hand-stroke'
  import type { BreathShapeParams } from '../lib/tracking/breath-shape'
  import type { PointingParams } from '../lib/tracking/gesture'
  import type { TaskStats } from '../lib/tracking/scheduler'
  import type { TrackerStatus } from './tracking-status'

  interface Props {
    stats: EngineStats | null
    faceStatus: TrackerStatus
    faceDebug: FaceBreathDebug | null
    faceParams: BreathShapeParams
    handStatus: TrackerStatus
    handDebug: HandStrokeDebug | null
    pointingParams: PointingParams
    /** Fréquence et durée réelles des inférences, mesurées par l'ordonnanceur. */
    taskStats: { face: TaskStats | null; hand: TaskStats | null }
  }

  let {
    stats,
    faceStatus,
    faceDebug,
    faceParams,
    handStatus,
    handDebug,
    pointingParams,
    taskStats,
  }: Props = $props()

  const rate = (t: TaskStats | null) =>
    t ? `${t.rate.toFixed(0)} fps · ${t.avgMs.toFixed(1)} ms` : '—'

  // Les jauges vont de 0 à 1 ; le score peut dépasser 1.
  const pct = (v: number) => `${Math.min(Math.max(v, 0), 1) * 100}%`
</script>

<aside>
  {#if stats}
    <div>rendu <b>{stats.renderFps.toFixed(0)}</b> fps</div>
    <div>caméra <b>{stats.cameraFps > 0 ? stats.cameraFps.toFixed(0) : '—'}</b> fps</div>
    <div>vidéo {stats.videoSize[0]}×{stats.videoSize[1]}</div>
    <div>canvas {stats.canvasSize[0]}×{stats.canvasSize[1]}</div>
    <div>buée {stats.fieldSize[0]}×{stats.fieldSize[1]} {stats.fieldFormat}</div>
    <div>gouttes qui coulent <b>{stats.drips}</b></div>
  {:else}
    <div>démarrage…</div>
  {/if}

  <hr />
  {#if faceStatus.name === 'ready' && faceDebug}
    <div>
      visage <b>{faceDebug.face ? 'détecté' : 'absent'}</b> · {faceStatus.delegate}
    </div>
    <div>détection <b>{rate(taskStats.face)}</b></div>
    <div class="gauge" title="Score de forme de souffle">
      <span
        class="fill"
        class:active={faceDebug.breath.active}
        style:width={pct(faceDebug.breath.score)}
      ></span>
      <span class="mark" style:left={pct(faceParams.offThreshold)}></span>
      <span class="mark on" style:left={pct(faceParams.onThreshold)}></span>
    </div>
    <div>
      souffle <b>{faceDebug.breath.active ? 'oui' : 'non'}</b> · score {faceDebug.breath.score.toFixed(
        2,
      )}
    </div>
    {#if faceDebug.face}
      {@const s = faceDebug.face.observation.shape}
      <div class="muted">
        mâchoire {s.jawOpen.toFixed(2)} · o {s.mouthFunnel.toFixed(2)} · moue {s.mouthPucker.toFixed(
          2,
        )}
      </div>
    {/if}
  {:else if faceStatus.name === 'error'}
    <div>visage <b>indisponible</b></div>
  {:else}
    <div>visage : chargement…</div>
  {/if}
  <hr />
  {#if handStatus.name === 'ready' && handDebug}
    <div>
      main <b>{handDebug.landmarks ? 'détectée' : 'absente'}</b> · {handStatus.delegate}
    </div>
    <div>détection <b>{rate(taskStats.hand)}</b></div>
    {#if handDebug.pose}
      {@const p = handDebug.pose}
      <div>
        écrit <b>{handDebug.drawing ? 'oui' : 'non'}</b> · index {p.index.toFixed(2)}
        <span class="muted">(≥ {pointingParams.indexOn})</span>
      </div>
      <div class="muted">
        majeur {p.middle.toFixed(2)} · annulaire {p.ring.toFixed(2)} · auriculaire {p.pinky.toFixed(
          2,
        )} (≤ {pointingParams.othersOn})
      </div>
    {/if}
  {:else if handStatus.name === 'error'}
    <div>main <b>indisponible</b></div>
  {:else}
    <div>main : chargement…</div>
  {/if}
  <div class="hint">D : masquer les réglages</div>
</aside>

<style>
  aside {
    position: fixed;
    top: 12px;
    left: 12px;
    width: 260px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.55);
    color: #e6e6e6;
    font:
      12px/1.5 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  b {
    color: #fff;
  }

  hr {
    margin: 6px 0;
    border: 0;
    border-top: 1px solid rgb(255 255 255 / 0.15);
  }

  .gauge {
    position: relative;
    height: 8px;
    margin: 4px 0;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.12);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: #9aa3ad;
  }

  .fill.active {
    background: #6ee7a8;
  }

  .mark {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgb(255 255 255 / 0.5);
  }

  .mark.on {
    background: #fff;
  }

  .muted,
  .hint {
    color: #9a9a9a;
  }

  .hint {
    margin-top: 4px;
  }
</style>
