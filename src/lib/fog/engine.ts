import { coverTransform, type CoverTransform } from '../coords'
import type { InputBus, Segment } from '../input/events'
import { FpsMeter } from '../perf/fps'
import { BlurPyramid } from './blur'
import { DripSystem, MAX_DRIPS } from './drips'
import { FogField, type FieldFormat } from './field'
import { createProgram, createVideoTexture, resolveIncludes, uniformLocations } from './gl'
import { strokeWidth, type FogParams } from './params'
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
  drips: number
  quality: Quality
}

/** Réglage de qualité appliqué par la qualité adaptative. */
export interface Quality {
  /** Densité de pixels maximale du canvas. */
  pixelRatio: number
  /** Facteur appliqué à la résolution du champ de buée (params.fieldScale). */
  fieldScale: number
}

/** Durée de l'effacement progressif du miroir, en secondes. */
const WIPE_DURATION = 0.7
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
  'uFade',
  'uEvaporation',
  'uEvaporationFloor',
  'uEvaporationVariation',
  'uDiffusion',
  'uRefogTime',
  'uRefogAmount',
  'uBreathCount',
  'uBreaths',
  'uBreathRate',
  'uBreathSpread',
  'uBreathWarp',
  'uSegmentCount',
  'uSegments',
  'uSegmentWidths',
  'uStrokeRadius',
  'uStrokeStrength',
  'uStrokeEdgeNoise',
  'uStrokeStreaks',
  'uStrokeRim',
] as const

const COMPOSITE_UNIFORMS = [
  'uVideo',
  'uBlurLight',
  'uBlurHeavy',
  'uField',
  'uFieldTexel',
  'uCoverScale',
  'uCoverOffset',
  'uAspect',
  'uVeilOpacity',
  'uFogColor',
  'uScatter',
  'uDroplets',
  'uDropletScale',
  'uWetEdge',
  'uRefraction',
  'uGrain',
  'uMottling',
  'uDripCount',
  'uDrips',
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
  private readonly blur: BlurPyramid
  private readonly drips: DripSystem
  private readonly dripData = new Float32Array(MAX_DRIPS * 4)
  private quality: Quality = { pixelRatio: 2, fieldScale: 1 }
  private wipeRemaining = 0
  private readonly renderFps = new FpsMeter()
  private readonly cameraFps = new FpsMeter()
  private readonly resizeObserver: ResizeObserver
  private readonly breathData = new Float32Array(MAX_BREATHS * 4)
  private readonly segmentData = new Float32Array(MAX_SEGMENTS * 4)
  private readonly segmentWidths = new Float32Array(MAX_SEGMENTS * 2)
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
    this.blur = new BlurPyramid(gl)
    this.drips = new DripSystem(params)

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
    this.blur.dispose()
    this.gl.deleteTexture(this.videoTexture)
    this.gl.deleteProgram(this.updateProgram)
    this.gl.deleteProgram(this.compositeProgram)
  }

  /** Remplit le miroir de buée (`density` = 1) ou l'efface (`density` = 0). */
  /** Efface progressivement tout le miroir (en WIPE_DURATION secondes). */
  wipeAll(): void {
    this.wipeRemaining = WIPE_DURATION
    this.drips.clear(this.input)
  }

  /** Fixe la qualité de rendu (densité de pixels, résolution du champ). */
  setQuality(quality: Quality): void {
    this.quality = quality
    this.resize()
  }

  /**
   * Image actuelle du miroir en PNG, telle qu'à l'écran (reflet en miroir, texte écrit lisible),
   * sans l'interface, qui n'est pas dans le canvas.
   */
  capture(): Promise<Blob | null> {
    // Sans preserveDrawingBuffer, le canvas n'est lisible que juste après un rendu : on en refait un.
    this.composite()
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  fillFog(density: number): void {
    this.field.fill(density)
    // Un miroir essuyé n'a plus d'eau pour faire couler des gouttes.
    if (density === 0) this.drips.clear(this.input)
  }

  get stats(): EngineStats {
    return {
      renderFps: this.renderFps.fpsAt(performance.now()),
      cameraFps: this.cameraFps.fpsAt(performance.now()),
      canvasSize: [this.canvas.width, this.canvas.height],
      videoSize: [this.video.videoWidth, this.video.videoHeight],
      fieldSize: [this.field.width, this.field.height],
      fieldFormat: this.field.format,
      drips: this.drips.count,
      quality: this.quality,
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
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio)
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
      Math.max(1, Math.round(canvas.width * params.fieldScale * this.quality.fieldScale)),
      Math.max(1, Math.round(canvas.height * params.fieldScale * this.quality.fieldScale)),
    )
  }

  private frame(time: number, dt: number): void {
    const { gl, params } = this
    if (gl.isContextLost()) return

    // La résolution du champ peut changer depuis le panneau de réglages.
    this.resizeField()
    this.uploadVideo()

    // Les gouttes qui coulent tracent leurs traînées dans le bus, comme un doigt ; elles naissent
    // des tracés et des souffles de la frame.
    this.drips.update(dt, this.input)
    const { breaths, segments } = this.input.drain()
    this.drips.observe(segments, breaths, dt)
    this.breathData.fill(0)
    breaths.slice(0, MAX_BREATHS).forEach((b, i) => {
      this.breathData.set([b.x, b.y, params.breathRadius * (b.scale ?? 1), b.intensity], i * 4)
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
      // Le flou ne change qu'avec l'image : on le recalcule seulement à chaque nouvelle image.
      this.blur.run(this.videoTexture, video.videoWidth, video.videoHeight, this.params.blurSpread)
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
    this.segmentWidths.fill(1)
    segments.forEach((s, i) => {
      this.segmentData.set([s.a.x, s.a.y, s.b.x, s.b.y], i * 4)
      this.segmentWidths.set(
        [s.a.width ?? strokeWidth(s.a.speed, params), s.b.width ?? strokeWidth(s.b.speed, params)],
        i * 2,
      )
    })

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
    gl.uniform1f(u.uDither, field.format === 'RG8' && dt > 0 ? 1 / 255 : 0)
    // Effacement global : décroissance exponentielle rapide, jusqu'à zéro à la fin.
    const fade =
      this.wipeRemaining > 0 ? (dt >= this.wipeRemaining ? 1 : 1 - Math.exp(-dt / 0.12)) : 0
    this.wipeRemaining = Math.max(0, this.wipeRemaining - dt)
    gl.uniform1f(u.uFade, fade)
    gl.uniform1f(u.uEvaporation, params.evaporation)
    gl.uniform1f(u.uEvaporationFloor, params.evaporationFloor)
    gl.uniform1f(u.uEvaporationVariation, params.evaporationVariation)
    gl.uniform1f(u.uDiffusion, params.diffusion)
    gl.uniform1f(u.uRefogTime, params.refogTime)
    gl.uniform1f(u.uRefogAmount, params.refogAmount)
    gl.uniform1i(u.uBreathCount, Math.min(breathCount, MAX_BREATHS))
    gl.uniform4fv(u.uBreaths, this.breathData)
    gl.uniform1f(u.uBreathRate, params.breathRate)
    gl.uniform1f(u.uBreathSpread, params.breathSpread)
    gl.uniform1f(u.uBreathWarp, params.breathWarp)
    gl.uniform1i(u.uSegmentCount, segments.length)
    gl.uniform4fv(u.uSegments, this.segmentData)
    gl.uniform2fv(u.uSegmentWidths, this.segmentWidths)
    gl.uniform1f(u.uStrokeRadius, params.strokeRadius)
    gl.uniform1f(u.uStrokeStrength, params.strokeStrength)
    gl.uniform1f(u.uStrokeEdgeNoise, params.strokeEdgeNoise)
    gl.uniform1f(u.uStrokeStreaks, params.strokeStreaks)
    gl.uniform1f(u.uStrokeRim, params.strokeRim)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    field.swap()
  }

  private composite(): void {
    const { gl, canvas, field, params, blur } = this
    const u = this.compositeUniforms

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(this.compositeProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.uniform1i(u.uVideo, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, field.read.texture)
    gl.uniform1i(u.uField, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, blur.light)
    gl.uniform1i(u.uBlurLight, 2)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, blur.heavy)
    gl.uniform1i(u.uBlurHeavy, 3)
    gl.uniform2f(u.uFieldTexel, 1 / field.width, 1 / field.height)
    gl.uniform2fv(u.uCoverScale, this.cover.scale)
    gl.uniform2fv(u.uCoverOffset, this.cover.offset)
    gl.uniform1f(u.uAspect, canvas.width / canvas.height)
    gl.uniform1f(u.uVeilOpacity, params.veilOpacity)
    gl.uniform3f(u.uFogColor, params.fogColor.r, params.fogColor.g, params.fogColor.b)
    gl.uniform1f(u.uScatter, params.veilScatter)
    gl.uniform1f(u.uDroplets, params.droplets)
    gl.uniform1f(u.uDropletScale, params.dropletScale)
    gl.uniform1f(u.uWetEdge, params.wetEdge)
    gl.uniform1f(u.uRefraction, params.refraction)
    gl.uniform1f(u.uGrain, params.grain)
    gl.uniform1f(u.uMottling, params.mottling)
    const heads = this.drips.heads()
    this.dripData.fill(0)
    heads.forEach((h, i) => this.dripData.set([h.x, h.y, h.radius, 0], i * 4))
    gl.uniform1i(u.uDripCount, heads.length)
    gl.uniform4fv(u.uDrips, this.dripData)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
