// Mains synthétiques pour les tests (en mètres, comme les worldLandmarks de MediaPipe).
import type { Point3 } from './hand-landmarks'

export type FingerState = 'extended' | 'curled'

/**
 * Main synthétique en mètres, poignet à l'origine, doigts vers le haut (-y).
 * Chaque doigt : MCP, PIP, DIP, bout.
 */
export function hand(
  fingers: Record<'index' | 'middle' | 'ring' | 'pinky', FingerState>,
): Point3[] {
  const pts: Point3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  // Pouce replié contre la paume.
  for (let i = 1; i <= 4; i++) pts[i] = { x: 0.03 + i * 0.005, y: -0.03 - i * 0.01, z: 0.01 }
  const columns = {
    index: [5, 0.02],
    middle: [9, 0],
    ring: [13, -0.02],
    pinky: [17, -0.04],
  } as const
  for (const [name, [first, x]] of Object.entries(columns)) {
    const state = fingers[name as keyof typeof fingers]
    pts[first] = { x, y: -0.09, z: 0 }
    pts[first + 1] = { x, y: -0.13, z: 0 }
    if (state === 'extended') {
      pts[first + 2] = { x, y: -0.155, z: 0 }
      pts[first + 3] = { x, y: -0.175, z: 0 }
    } else {
      pts[first + 2] = { x, y: -0.115, z: 0.025 }
      pts[first + 3] = { x, y: -0.095, z: 0.03 }
    }
  }
  return pts
}
