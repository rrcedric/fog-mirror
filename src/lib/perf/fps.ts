/** Compteur de fréquence lissé (moyenne mobile exponentielle sur l'intervalle entre deux ticks). */
export class FpsMeter {
  private last = -1
  private avgDelta = 0

  constructor(private readonly smoothing = 0.1) {}

  tick(now: number): void {
    if (this.last >= 0) {
      const delta = now - this.last
      this.avgDelta =
        this.avgDelta === 0 ? delta : this.avgDelta + (delta - this.avgDelta) * this.smoothing
    }
    this.last = now
  }

  get fps(): number {
    return this.avgDelta > 0 ? 1000 / this.avgDelta : 0
  }
}
