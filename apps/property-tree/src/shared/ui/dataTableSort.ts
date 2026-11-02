export type SortOrder = 'asc' | 'desc'

export interface TableSort {
  key: string
  order: SortOrder
}

/** A table's sort as the page holds it: the current value and how to change it. */
export interface SortControl {
  value: TableSort
  /** The order the rows have when nobody has picked one. */
  fallback: TableSort
  onChange: (sort: TableSort) => void
}

export type SortValue = string | number | null | undefined

export interface ColumnSort<T> {
  /** Omit when the rows arrive sorted from the server. */
  value?: (item: T) => SortValue
  kind: 'text' | 'number' | 'date'
  /** The direction a first click on the column sorts in. Defaults to asc. */
  firstOrder?: SortOrder
}

export interface SortableColumn<T> {
  key: string
  label: string
  sort?: ColumnSort<T>
}

const collator = new Intl.Collator('sv', { numeric: true, sensitivity: 'base' })

const isBlank = (value: SortValue) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '')

const compareValues = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : collator.compare(String(a), String(b))

/** Sorts a copy of the rows; blank values go last in both directions. */
export const sortRows = <T>(
  rows: T[],
  value: (item: T) => SortValue,
  order: SortOrder
): T[] => {
  const direction = order === 'asc' ? 1 : -1
  return rows
    .map((item) => ({ item, value: value(item) }))
    .sort((a, b) => {
      const aBlank = isBlank(a.value)
      const bBlank = isBlank(b.value)
      if (aBlank || bBlank) return Number(aBlank) - Number(bBlank)
      return (
        direction *
        compareValues(a.value as string | number, b.value as string | number)
      )
    })
    .map(({ item }) => item)
}

export const nextSort = <T>(
  current: TableSort | undefined,
  column: SortableColumn<T>
): TableSort =>
  current?.key === column.key
    ? { key: column.key, order: current.order === 'asc' ? 'desc' : 'asc' }
    : { key: column.key, order: column.sort?.firstOrder ?? 'asc' }

export const ariaSort = <T>(
  column: SortableColumn<T>,
  sort: TableSort | undefined
): 'ascending' | 'descending' | 'none' | undefined => {
  if (!column.sort) return undefined
  if (sort?.key !== column.key) return 'none'
  return sort.order === 'asc' ? 'ascending' : 'descending'
}

const ORDER_WORDS: Record<
  ColumnSort<unknown>['kind'],
  Record<SortOrder, string>
> = {
  text: { asc: 'A–Ö', desc: 'Ö–A' },
  number: { asc: 'lägst först', desc: 'högst först' },
  date: { asc: 'äldst först', desc: 'nyast först' },
}

export const sortOptionLabel = <T>(
  column: SortableColumn<T>,
  order: SortOrder
): string =>
  `${column.label}, ${ORDER_WORDS[column.sort?.kind ?? 'text'][order]}`
