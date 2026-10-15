/** Étapes du guide d'accueil. */
export type OnboardingStep = 'breathe' | 'write' | 'clear' | 'done'

export type OnboardingEvent =
  /** L'utilisateur a soufflé (assez longtemps pour voir la buée). */
  | 'breathed'
  /** Il a écrit un trait d'une longueur suffisante. */
  | 'wrote'
  /** Il a tout effacé (geste, bouton ou touche). */
  | 'cleared'
  /** Il passe à l'étape suivante sans l'avoir faite. */
  | 'next'
  /** Il ferme le guide. */
  | 'skip'

const ORDER: OnboardingStep[] = ['breathe', 'write', 'clear', 'done']
const COMPLETES: Record<OnboardingStep, OnboardingEvent | null> = {
  breathe: 'breathed',
  write: 'wrote',
  clear: 'cleared',
  done: null,
}

export function advance(step: OnboardingStep, event: OnboardingEvent): OnboardingStep {
  if (event === 'skip') return 'done'
  if (event === 'next' || COMPLETES[step] === event) {
    return ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]
  }
  return step
}

/** Numéro de l'étape (1 à 3) pour l'affichage. */
export function stepNumber(step: OnboardingStep): number {
  return ORDER.indexOf(step) + 1
}
