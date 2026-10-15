// Constantes et types des landmarks de la main, sans dépendance à MediaPipe : ce module peut
// être importé par le code chargé au démarrage sans embarquer le runtime.

export interface Point3 {
  x: number
  y: number
  z: number
}

/** Indices des 21 landmarks de MediaPipe Hands. */
export const HAND = {
  WRIST: 0,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const

/** Segments du squelette de la main, pour l'overlay de debug. */
export const HAND_BONES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]
