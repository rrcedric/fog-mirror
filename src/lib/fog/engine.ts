import { coverTransform, type CoverTransform } from '../coords'
import type { InputBus, Segment } from '../input/events'
import { FpsMeter } from '../perf/fps'
import { FogField, type FieldFormat } from './field'
import { createProgram, createVideoTexture, resolveIncludes, uniformLocations } from './gl'
import type { FogParams } from './params'
import compositeFrag from './passes/composite.frag?raw'
import fullscreenVert from './passes/fullscreen.vert?raw'
import noiseGlsl from './passes/noise.glsl?raw'
import updateFrag from './passes/update.frag?raw'

export interface EngineStats {
  renderFps: number
  cameraFps: number
  canvasSize: [number, number]
  videoSize: [number, number]
  fieldSize: [number, number]
  fieldFormat: FieldFormat
}

const MAX_PIXEL_RATIO = 2
/** Pas de temps maximal : évite un saut brutal après un onglet resté en arrière-plan. */
const MAX_DT = 1 / 20
// Doivent correspondre aux #define de update.frag.
const MAX_BREATHS = 4
const MAX_SEGMENTS = 32

const INCLUDES = { 'noise.glsl': noiseGlsl }

const UPDATE_UNIFORMS = [
  'uField',
  'uTexel',
  'uAspect',
  'uTime',
  'uDt',
  'uDither',
  'uEvaporation',
  'uEvaporationFloor',
  'uEvaporationVariation',
  'uDiffusion',
  'uBreathCount',
  'uBreaths',
  'uBreathRate',
  'uSegmentCount',
  'uSegments',
  'uStrokeRadius',
  'uStrokeStrength',
] as const

const COMPOSITE_UNIFORMS = [
  'uVideo',
  'uField',
  'uCoverScale',
  'uCoverOffset',
  'uAspect',
  'uVideoSize',
  'uBlurRadius',
  'uVeilOpacity',
  'uFogColor',
] as const

/**
 * Boucle de rendu WebGL2 : fait évoluer le champ de buée à partir des événements du bus,
 * puis affiche la vidéo de la caméra en miroir, floutée et voilée selon la buée.
 */
export class MirrorEngine {
  private readonly gl: WebGL2RenderingContext
  private readonly updateProgram: WebGLProgram
  private readonly compositeProgram: WebGLProgram
  private readonly updateUniforms
  private readonly compositeUniforms
  private readonly videoTexture: WebGLTexture
  private readonly field: FogField
  private readonly renderFps = new FpsMeter()
  private readonly cameraFps = new FpsMeter()
  private readonly resizeObserver: ResizeObserver
  private readonly breathData = new Float32Array(MAX_BREATHS * 4)
  private readonly segmentData = new Float32Array(MAX_SEGMENTS * 4)
  private rafId = 0
  private videoFrameId = 0
  private hasNewFrame = false
  private lastTime = -1
  private cover: CoverTransform = { scale: [1, 1], offset: [0, 0] }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
    private readonly input: InputBus,
    private readonly params: FogParams,
    options: { fieldFormat?: FieldFormat } = {},
  ) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl

    this.updateProgram = createProgram(gl, fullscreenVert, resolveIncludes(updateFrag, INCLUDES))
    this.updateUniforms = uniformLocations(gl, this.updateProgram, UPDATE_UNIFORMS)
    this.compositeProgram = createProgram(
      gl,
      fullscreenVert,
      resolveIncludes(compositeFrag, INCLUDES),
    )
    this.compositeUniforms = uniformLocations(gl, this.compositeProgram, COMPOSITE_UNIFORMS)
    this.videoTexture = createVideoTexture(gl)
    this.field = new FogField(gl, options.fieldFormat)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
  }

  start(): void {
    if (this.rafId) return
    this.watchVideoFrames()
    const loop = (now: number) => {
      this.rafId = requestAnimationFrame(loop)
      this.renderFps.tick(now)
      const dt = this.lastTime < 0 ? 0 : Math.min((now - this.lastTime) / 1000, MAX_DT)
      this.lastTime = now
      this.frame(now / 1000, dt)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.lastTime = -1
    if (this.videoFrameId) this.video.cancelVideoFrameCallback(this.videoFrameId)
    this.videoFrameId = 0
  }

  dispose(): void {
    this.stop()
    this.resizeObserver.disconnect()
    this.field.dispose()
    this.gl.deleteTexture(this.videoTexture)
    this.gl.deleteProgram(this.updateProgram)
    this.gl.deleteProgram(this.compositeProgram)
  }

  /** Remplit le miroir de buée (`density` = 1) ou l'efface (`density` = 0). */
  fillFog(density: number): void {
    this.field.fill(density)
  }

  get stats(): EngineStats {
    return {
      renderFps: this.renderFps.fps,
      cameraFps: this.cameraFps.fps,
      canvasSize: [this.canvas.width, this.canvas.height],
      videoSize: [this.video.videoWidth, this.video.videoHeight],
      fieldSize: [this.field.width, this.field.height],
      fieldFormat: this.field.format,
    }
  }

  /** Recadrage courant entre la vidéo et l'écran, pour convertir des coordonnées (voir coords.ts). */
  get coverTransform(): CoverTransform {
    return this.cover
  }

  private watchVideoFrames(): void {
    if (!('requestVideoFrameCallback' in this.video)) {
      // Sans rVFC, on téléverse la texture à chaque frame de rendu.
      this.hasNewFrame = true
      return
    }
    const onFrame = (now: number) => {
      this.videoFrameId = this.video.requestVideoFrameCallback(onFrame)
      this.cameraFps.tick(now)
      this.hasNewFrame = true
    }
    this.videoFrameId = this.video.requestVideoFrameCallback(onFrame)
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.resizeField()
  }

  private resizeField(): void {
    const { canvas, params } = this
    this.field.resize(
      Math.max(1, Math.round(canvas.width * params.fieldScale)),
      Math.max(1, Math.round(canvas.height * params.fieldScale)),
    )
  }

  private frame(time: number, dt: number): void {
    const { gl, params } = this
    if (gl.isContextLost()) return

    // La résolution du champ peut changer depuis le panneau de réglages.
    this.resizeField()
    this.uploadVideo()

    const { breaths, segments } = this.input.drain()
    this.breathData.fill(0)
    breaths.slice(0, MAX_BREATHS).forEach((b, i) => {
      this.breathData.set([b.x, b.y, params.breathRadius, b.intensity], i * 4)
    })
    // Au-delà de MAX_SEGMENTS segments dans une frame, on enchaîne des passes supplémentaires
    // sans faire avancer le temps (dt = 0).
    const chunks: Segment[][] = []
    for (let i = 0; i < segments.length; i += MAX_SEGMENTS) {
      chunks.push(segments.slice(i, i + MAX_SEGMENTS))
    }
    if (chunks.length === 0) chunks.push([])
    chunks.forEach((chunk, i) => {
      this.updateField(time, i === 0 ? dt : 0, i === 0 ? breaths.length : 0, chunk)
    })

    this.composite()
  }

  private uploadVideo(): void {
    const { gl, video } = this
    const ready = video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0
    if (!ready) return
    if (this.hasNewFrame) {
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.generateMipmap(gl.TEXTURE_2D)
      if ('requestVideoFrameCallback' in video) this.hasNewFrame = false
    }
    this.cover = coverTransform(
      video.videoWidth / video.videoHeight,
      this.canvas.width / this.canvas.height,
    )
  }

  private updateField(time: number, dt: number, breathCount: number, segments: Segment[]): void {
    const { gl, field, params } = this
    const u = this.updateUniforms

    this.segmentData.fill(0)
    segments.forEach((s, i) => this.segmentData.set([s.a.x, s.a.y, s.b.x, s.b.y], i * 4))

    gl.bindFramebuffer(gl.FRAMEBUFFER, field.write.framebuffer)
    gl.viewport(0, 0, field.width, field.height)
    gl.useProgram(this.updateProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, field.read.texture)
    gl.uniform1i(u.uField, 0)
    gl.uniform2f(u.uTexel, 1 / field.width, 1 / field.height)
    gl.uniform1f(u.uAspect, field.width / field.height)
    gl.uniform1f(u.uTime, time)
    gl.uniform1f(u.uDt, dt)
    gl.uniform1f(u.uDither, field.format === 'R8' && dt > 0 ? 1 / 255 : 0)
    gl.uniform1f(u.uEvaporation, params.evaporation)
    gl.uniform1f(u.uEvaporationFloor, params.evaporationFloor)
    gl.uniform1f(u.uEvaporationVariation, params.evaporationVariation)
    gl.uniform1f(u.uDiffusion, params.diffusion)
    gl.uniform1i(u.uBreathCount, Math.min(breathCount, MAX_BREATHS))
    gl.uniform4fv(u.uBreaths, this.breathData)
    gl.uniform1f(u.uBreathRate, params.breathRate)
    gl.uniform1i(u.uSegmentCount, segments.length)
    gl.uniform4fv(u.uSegments, this.segmentData)
    gl.uniform1f(u.uStrokeRadius, params.strokeRadius)
    gl.uniform1f(u.uStrokeStrength, params.strokeStrength)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    field.swap()
  }

  private composite(): void {
    const { gl, canvas, field, params, video } = this
    const u = this.compositeUniforms

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(this.compositeProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.uniform1i(u.uVideo, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, field.read.texture)
    gl.uniform1i(u.uField, 1)
    gl.uniform2fv(u.uCoverScale, this.cover.scale)
    gl.uniform2fv(u.uCoverOffset, this.cover.offset)
    gl.uniform1f(u.uAspect, canvas.width / canvas.height)
    gl.uniform2f(u.uVideoSize, video.videoWidth || 1, video.videoHeight || 1)
    gl.uniform1f(u.uBlurRadius, params.blurRadius)
    gl.uniform1f(u.uVeilOpacity, params.veilOpacity)
    gl.uniform3f(u.uFogColor, params.fogColor.r, params.fogColor.g, params.fogColor.b)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
