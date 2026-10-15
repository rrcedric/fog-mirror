import type { FogField } from './field'
import { createProgram, uniformLocations } from './gl'
import fullscreenVert from './passes/fullscreen.vert?raw'
import probeFrag from './passes/probe.frag?raw'

const WIDTH = 64
const HEIGHT = 48

/**
 * Copie basse résolution du champ de buée, relue par le processeur pour que la logique en
 * JavaScript (les gouttes qui coulent) sache où il y a de la buée. La relecture bloque brièvement
 * le GPU : on ne la fait que quelques fois par seconde, sur une toute petite texture.
 */
export class FieldProbe {
  private readonly program: WebGLProgram
  private readonly uniforms
  private readonly texture: WebGLTexture
  private readonly framebuffer: WebGLFramebuffer
  private readonly pixels = new Uint8Array(WIDTH * HEIGHT * 4)

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, fullscreenVert, probeFrag)
    this.uniforms = uniformLocations(gl, this.program, ['uField'])
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    this.framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** Relit le champ. */
  update(field: FogField): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.viewport(0, 0, WIDTH, HEIGHT)
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, field.read.texture)
    gl.uniform1i(this.uniforms.uField, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** Buée visible (0..1) au point écran (x, y), d'après la dernière relecture. */
  densityAt(x: number, y: number): number {
    const col = Math.min(Math.max(Math.floor(x * WIDTH), 0), WIDTH - 1)
    // La texture a son origine en bas (convention GL), l'écran en haut.
    const row = Math.min(Math.max(Math.floor((1 - y) * HEIGHT), 0), HEIGHT - 1)
    return this.pixels[(row * WIDTH + col) * 4] / 255
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer)
    this.gl.deleteTexture(this.texture)
    this.gl.deleteProgram(this.program)
  }
}
