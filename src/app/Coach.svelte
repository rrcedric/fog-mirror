<script lang="ts">
  import { stepNumber, type OnboardingStep } from './onboarding'

  interface Props {
    step: Exclude<OnboardingStep, 'done'>
    /** Le suivi du visage est-il disponible (sinon on explique la souris) ? */
    faceAvailable: boolean
    handAvailable: boolean
    onnext: () => void
    onskip: () => void
  }

  let { step, faceAvailable, handAvailable, onnext, onskip }: Props = $props()

  let content = $derived(
    {
      breathe: {
        title: 'Soufflez sur le miroir',
        text: faceAvailable
          ? 'Approchez-vous et soufflez bouche ouverte, comme sur un vrai miroir.'
          : 'Maintenez le clic gauche pour souffler.',
      },
      write: {
        title: 'Écrivez dans la buée',
        text: handAvailable
          ? 'Tendez l’index, les autres doigts repliés, et écrivez en l’air. Le cercle se remplit quand vous écrivez.'
          : 'Glissez avec le clic droit (ou Maj + clic) pour écrire.',
      },
      clear: {
        title: 'Tout effacer',
        text: handAvailable
          ? 'Montrez votre main ouverte une seconde, ou utilisez le bouton Effacer.'
          : 'Utilisez le bouton Effacer ou la touche C.',
      },
    }[step],
  )
</script>

<section class="coach" aria-live="polite">
  <p class="step">Étape {stepNumber(step)} sur 3</p>
  <h2>{content.title}</h2>
  <p class="text">{content.text}</p>
  <div class="actions">
    <button class="secondary" onclick={onskip}>Passer le guide</button>
    <button onclick={onnext}>{step === 'clear' ? 'C’est parti' : 'Étape suivante'}</button>
  </div>
</section>

<style>
  .coach {
    width: min(420px, calc(100vw - 32px));
    padding: 18px 20px 16px;
    border: 1px solid var(--card-border);
    border-radius: 18px;
    background: rgb(12 14 18 / 0.62);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    color: var(--fg);
  }

  .step {
    margin: 0 0 4px;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  h2 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    font-weight: 600;
  }

  .text {
    margin: 0 0 14px;
    line-height: 1.45;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    padding: 8px 14px;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-fg);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  button.secondary {
    background: transparent;
    color: var(--muted);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
