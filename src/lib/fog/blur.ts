import { createProgram, uniformLocations } from './gl'
import fullscreenVert from './passes/fullscreen.vert?raw'
import kawaseDownFrag from './passes/kawase-down.frag?raw'
import kawaseUpFrag from './passes/kawase-up.frag?raw'

/** Nombre de réductions pour le flou fort (1/2 … 1/32 de la taille de la vidéo). */
const LEVELS = 5

interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { texture, framebuffer, width, height }
}

function deleteTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteFramebuffer(t.framebuffer)
  gl.deleteTexture(t.texture)
}

/**
 * Deux versions floutées de l'image de la caméra, calculées par une pyramide « dual Kawase » :
 * un flou léger (une réduction) et un flou fort (cinq réductions). Peu coûteux, car presque
 * tout le travail se fait sur de petites textures, et recalculé seulement à chaque nouvelle image.
 *
 * Les textures gardent l'orientation de la vidéo : on les lit avec les mêmes coordonnées.
 */
export class BlurPyramid {
  private readonly down: WebGLProgram
  private readonly up: WebGLProgram
  private readonly downUniforms
  private readonly upUniforms
  private levels: Target[] = []
  private ups: Target[] = []
  private lightTarget: Target | null = null
  private width = 0
  private height = 0

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.down = createProgram(gl, fullscreenVert, kawaseDownFrag)
    this.up = createProgram(gl, fullscreenVert, kawaseUpFrag)
    this.downUniforms = uniformLocations(gl, this.down, ['uSource', 'uHalfTexel'])
    this.upUniforms = uniformLocations(gl, this.up, ['uSource', 'uHalfTexel'])
  }

  /** Flou léger (moitié de la taille de la vidéo). */
  get light(): WebGLTexture | null {
    return this.lightTarget?.texture ?? null
  }

  /** Flou fort (moitié de la taille de la vidéo). */
  get heavy(): WebGLTexture | null {
    return this.ups[0]?.texture ?? null
  }

  /** Recalcule les deux flous à partir de `source`, une texture de `width` × `height`. */
  run(source: WebGLTexture, width: number, height: number, spread: number): void {
    this.resize(width, height)
    const { gl } = this
    let src: { texture: WebGLTexture; width: number; height: number } = {
      texture: source,
      width,
      height,
    }
    for (const level of this.levels) {
      this.pass(this.down, this.downUniforms, src, level, spread)
      src = level
    }
    // Flou léger : on remonte d'un seul niveau, depuis 1/4.
    this.pass(this.up, this.upUniforms, this.levels[1], this.lightTarget!, spread)
    // Flou fort : on remonte toute la pyramide jusqu'à 1/2.
    for (let i = LEVELS - 2; i >= 0; i--) {
      const from = i === LEVELS - 2 ? this.levels[LEVELS - 1] : this.ups[i + 1]
      this.pass(this.up, this.upUniforms, from, this.ups[i], spread)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  dispose(): void {
    this.release()
    this.gl.deleteProgram(this.down)
    this.gl.deleteProgram(this.up)
  }

  private pass(
    program: WebGLProgram,
    uniforms: Record<'uSource' | 'uHalfTexel', WebGLUniformLocation | null>,
    src: { texture: WebGLTexture; width: number; height: number },
    dst: Target,
    spread: number,
  ): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.framebuffer)
    gl.viewport(0, 0, dst.width, dst.height)
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.texture)
    gl.uniform1i(uniforms.uSource, 0)
    gl.uniform2f(uniforms.uHalfTexel, (0.5 / src.width) * spread, (0.5 / src.height) * spread)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.release()
    const { gl } = this
    const size = (i: number) =>
      [Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1))] as const
    this.levels = Array.from({ length: LEVELS }, (_, i) => createTarget(gl, ...size(i)))
    this.ups = Array.from({ length: LEVELS - 1 }, (_, i) => createTarget(gl, ...size(i)))
    this.lightTarget = createTarget(gl, ...size(0))
    this.width = width
    this.height = height
  }

  private release(): void {
    for (const t of [...this.levels, ...this.ups]) deleteTarget(this.gl, t)
    if (this.lightTarget) deleteTarget(this.gl, this.lightTarget)
    this.levels = []
    this.ups = []
    this.lightTarget = null
  }
}
