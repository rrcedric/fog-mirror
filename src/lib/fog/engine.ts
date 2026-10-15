import { coverTransform, type CoverTransform } from '../coords'
import { FpsMeter } from '../perf/fps'
import { createProgram, createVideoTexture, uniformLocations } from './gl'
import compositeFrag from './passes/composite.frag?raw'
import fullscreenVert from './passes/fullscreen.vert?raw'

export interface EngineStats {
  renderFps: number
  cameraFps: number
  canvasSize: [number, number]
  videoSize: [number, number]
}

const MAX_PIXEL_RATIO = 2

/** Boucle de rendu WebGL2 : affiche la vidéo de la caméra en miroir plein écran. */
export class MirrorEngine {
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly uniforms
  private readonly videoTexture: WebGLTexture
  private readonly renderFps = new FpsMeter()
  private readonly cameraFps = new FpsMeter()
  private readonly resizeObserver: ResizeObserver
  private rafId = 0
  private videoFrameId = 0
  private hasNewFrame = false
  private cover: CoverTransform = { scale: [1, 1], offset: [0, 0] }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
  ) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl
    this.program = createProgram(gl, fullscreenVert, compositeFrag)
    this.uniforms = uniformLocations(gl, this.program, ['uVideo', 'uCoverScale', 'uCoverOffset'])
    this.videoTexture = createVideoTexture(gl)

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
      this.render()
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    if (this.videoFrameId) this.video.cancelVideoFrameCallback(this.videoFrameId)
    this.videoFrameId = 0
  }

  dispose(): void {
    this.stop()
    this.resizeObserver.disconnect()
    this.gl.deleteTexture(this.videoTexture)
    this.gl.deleteProgram(this.program)
  }

  get stats(): EngineStats {
    return {
      renderFps: this.renderFps.fps,
      cameraFps: this.cameraFps.fps,
      canvasSize: [this.canvas.width, this.canvas.height],
      videoSize: [this.video.videoWidth, this.video.videoHeight],
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
  }

  private render(): void {
    const { gl, video } = this
    if (gl.isContextLost()) return

    const videoReady = video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0
    if (videoReady && this.hasNewFrame) {
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      if ('requestVideoFrameCallback' in video) this.hasNewFrame = false
    }
    if (videoReady) {
      this.cover = coverTransform(
        video.videoWidth / video.videoHeight,
        this.canvas.width / this.canvas.height,
      )
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.uniform1i(this.uniforms.uVideo, 0)
    gl.uniform2fv(this.uniforms.uCoverScale, this.cover.scale)
    gl.uniform2fv(this.uniforms.uCoverOffset, this.cover.offset)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
