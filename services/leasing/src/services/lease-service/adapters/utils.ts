type CamelToPascal<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S

type PascalToCamel<S extends string> = S extends `${infer F}${infer R}`
  ? `${Lowercase<F>}${R}`
  : S

export type PascalToCamelObject<T> = {
  [K in keyof T as PascalToCamel<K & string>]: T[K]
}

export type CamelToPascalObject<T> = {
  [K in keyof T as CamelToPascal<K & string>]: T[K]
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
const uncapitalize = (str: string) => str.charAt(0).toLowerCase() + str.slice(1)

export const camelToPascal = <T>(obj: { [K in keyof T]: T[K] }) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [capitalize(k), v])
  ) as CamelToPascalObject<T>

export const pascalToCamel = <T>(obj: { [K in keyof T]: T[K] }) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [uncapitalize(k), v])
  ) as PascalToCamelObject<T>

export const trimRow = (obj: any): any => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  )
}
