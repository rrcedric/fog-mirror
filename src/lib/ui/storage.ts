// Mémoire locale du navigateur, pour des préférences sans importance : elle peut être vide,
// pleine ou refusée (navigation privée, données bloquées). On n'échoue jamais à cause d'elle.

const PREFIX = 'fog-mirror:'

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Préférence non mémorisée : sans conséquence.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Idem.
  }
}
