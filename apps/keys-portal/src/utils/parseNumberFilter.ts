/**
 * Parses a number filter string into query parameters for the search API.
 *
 * Supported formats:
 * - `42` → exact match: `"42"`
 * - `<50` → less than: `"<50"`
 * - `>100` → greater than: `">100"`
 * - `<=50` → less than or equal: `"<=50"`
 * - `>=100` → greater than or equal: `">=100"`
 * - `50-100` → range (inclusive): `[">=50", "<=100"]`
 *
 * Returns `undefined` if input is empty or invalid.
 */
export function parseNumberFilter(
  input: string
): string | string[] | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  // Range: "a-b" (e.g. "50-100")
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (rangeMatch) {
    const from = rangeMatch[1]
    const to = rangeMatch[2]
    return [`>=${from}`, `<=${to}`]
  }

  // Comparison operators: >=, <=, >, <
  const compMatch = trimmed.match(/^(>=|<=|>|<)\s*(\d+)$/)
  if (compMatch) {
    return `${compMatch[1]}${compMatch[2]}`
  }

  // Exact number
  const exactMatch = trimmed.match(/^\d+$/)
  if (exactMatch) {
    return trimmed
  }

  return undefined
}
