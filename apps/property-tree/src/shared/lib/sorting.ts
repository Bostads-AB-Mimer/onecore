/**
 * Compares two strings using locale-aware numeric sorting.
 * Handles strings with numbers naturally (e.g., "item2" < "item10").
 */
export const numericCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true })
