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
