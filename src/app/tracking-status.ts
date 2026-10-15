/** État de chargement d'un modèle de suivi (visage ou main). */
export type TrackerStatus =
  { name: 'loading' } | { name: 'ready'; delegate: 'GPU' | 'CPU' } | { name: 'error' }
