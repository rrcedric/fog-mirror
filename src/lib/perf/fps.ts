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

  /**
   * Fréquence à l'instant `now` : comme `fps`, mais si aucun tick n'est arrivé depuis plus longtemps
   * que l'intervalle moyen, la fréquence ne peut pas dépasser 1 / (temps écoulé depuis le dernier).
   * Évite d'afficher une valeur figée quand les ticks s'arrêtent (onglet suspendu, caméra coupée).
   */
  fpsAt(now: number): number {
    if (this.last < 0) return 0
    const since = now - this.last
    return since > this.avgDelta ? Math.min(this.fps, 1000 / since) : this.fps
  }
}
