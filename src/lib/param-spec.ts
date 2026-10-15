/** Clés d'un objet de paramètres dont la valeur est un nombre. */
export type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T]

/** Description d'un réglage exposé dans le panneau de développement. */
export interface ParamSpec<T> {
  key: NumericKey<T>
  label: string
  min: number
  max: number
  step: number
  folder: string
}

/** Un objet de paramètres réglable dans le panneau, avec ses valeurs par défaut. */
export interface ParamGroup<T extends object> {
  target: T
  specs: ParamSpec<T>[]
  defaults: T
}

/** Construit un groupe en vérifiant les types, puis l'efface pour le stocker dans une liste. */
export function paramGroup<T extends object>(
  target: T,
  specs: ParamSpec<T>[],
  defaults: T,
): ParamGroup<object> {
  return { target, specs, defaults } as unknown as ParamGroup<object>
}
