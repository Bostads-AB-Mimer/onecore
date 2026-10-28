import { numericCompare } from './sorting'

export const sortBySwedishName = <T>(
  items: T[],
  getName: (item: T) => string
): T[] =>
  [...items].sort((a, b) => numericCompare(getName(a), getName(b), 'sv'))
