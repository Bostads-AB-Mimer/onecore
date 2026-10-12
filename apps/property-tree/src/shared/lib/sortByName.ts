export const sortBySwedishName = <T>(
  items: T[],
  getName: (item: T) => string
): T[] =>
  [...items].sort((a, b) =>
    getName(a).localeCompare(getName(b), 'sv', { numeric: true })
  )
