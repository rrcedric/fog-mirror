/** Deux canaux : buée visible (R) et humidité vers laquelle elle se reforme (G). */
export type FieldFormat = 'RG16F' | 'RG8'

interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
}

/** Choisit le format le plus précis dans lequel on peut effectivement dessiner. */
function detectFormat(gl: WebGL2RenderingContext): FieldFormat {
  const floatOk =
    gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
  if (!floatOk) return 'RG8'
  // Certains pilotes annoncent l'extension mais refusent le framebuffer : on vérifie.
  const probe = createTarget(gl, 'RG16F', 4, 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, probe.framebuffer)
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  deleteTarget(gl, probe)
  return ok ? 'RG16F' : 'RG8'
}

function createTarget(
  gl: WebGL2RenderingContext,
  format: FieldFormat,
  width: number,
  height: number,
): Target {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  if (format === 'RG16F') {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.HALF_FLOAT, null)
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, null)
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { texture, framebuffer }
}

function deleteTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteFramebuffer(t.framebuffer)
  gl.deleteTexture(t.texture)
}

/**
 * Champ de densité de buée : deux textures à deux canaux qu'on alterne (ping-pong).
 * On lit `read`, on dessine dans `write`, puis `swap()`.
 */
export class FogField {
  readonly format: FieldFormat
  width = 0
  height = 0
  private targets: [Target, Target] | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    forceFormat?: FieldFormat,
  ) {
    this.format = forceFormat ?? detectFormat(gl)
  }

  get read(): Target {
    return this.targets![0]
  }

  get write(): Target {
    return this.targets![1]
  }

  swap(): void {
    const t = this.targets!
    this.targets = [t[1], t[0]]
  }

  /** Redimensionne en conservant le contenu (mis à l'échelle). */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    const { gl } = this
    const next: [Target, Target] = [
      createTarget(gl, this.format, width, height),
      createTarget(gl, this.format, width, height),
    ]
    if (this.targets) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.read.framebuffer)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, next[0].framebuffer)
      gl.blitFramebuffer(
        0,
        0,
        this.width,
        this.height,
        0,
        0,
        width,
        height,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      )
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
      this.targets.forEach((t) => deleteTarget(gl, t))
    }
    this.targets = next
    this.width = width
    this.height = height
  }

  /** Remplit tout le champ avec une densité uniforme (buée visible et humidité). */
  fill(density: number): void {
    if (!this.targets) return
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.read.framebuffer)
    gl.clearColor(density, density, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  dispose(): void {
    this.targets?.forEach((t) => deleteTarget(this.gl, t))
    this.targets = null
  }
}
