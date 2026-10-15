/**
 * Espaces de coordonnées, tous normalisés dans [0, 1] avec l'origine en haut à gauche :
 * - vidéo : l'image brute de la caméra (c'est l'espace des landmarks MediaPipe) ;
 * - écran : ce que voit l'utilisateur, c'est-à-dire la vidéo recadrée (object-fit: cover)
 *   puis inversée gauche-droite pour faire miroir.
 */

export interface Point {
  x: number
  y: number
}

/** videoUV = mirror(screenUV) * scale + offset */
export interface CoverTransform {
  scale: [number, number]
  offset: [number, number]
}

/** Calcule le recadrage « cover » d'une source d'aspect `srcAspect` dans une cible d'aspect `dstAspect`. */
export function coverTransform(srcAspect: number, dstAspect: number): CoverTransform {
  if (srcAspect > dstAspect) {
    // Source plus large que la cible : on rogne à gauche et à droite.
    const sx = dstAspect / srcAspect
    return { scale: [sx, 1], offset: [(1 - sx) / 2, 0] }
  }
  // Source plus haute que la cible : on rogne en haut et en bas.
  const sy = srcAspect / dstAspect
  return { scale: [1, sy], offset: [0, (1 - sy) / 2] }
}

export function screenToVideo(p: Point, t: CoverTransform): Point {
  return {
    x: (1 - p.x) * t.scale[0] + t.offset[0],
    y: p.y * t.scale[1] + t.offset[1],
  }
}

export function videoToScreen(p: Point, t: CoverTransform): Point {
  return {
    x: 1 - (p.x - t.offset[0]) / t.scale[0],
    y: (p.y - t.offset[1]) / t.scale[1],
  }
}
