/**
 * Search term analyzer for rental block search
 * Determines which columns to search based on input pattern
 */

export interface RentalBlockSearchTarget {
  /** The field to search (rentalId, address, or blockReason) */
  field: 'rentalId' | 'address' | 'blockReason'
  /** The search pattern with appropriate wildcards */
  pattern: string
  /** Whether to use startsWith (true) or contains (false) matching */
  startsWith?: boolean
}

/**
 * Checks if input looks like a rental ID
 * Rental IDs have format like: 101-001-01-0101 (digits with dashes)
 * Or may be partial: 101-001 or just 101
 */
const isLikelyRentalId = (input: string): boolean => {
  // Rental ID pattern: starts with digits, may contain dashes
  // Examples: "101", "101-001", "101-001-01-0101"
  return /^\d[\d-]*$/.test(input)
}

/**
 * Checks if input is a partial rental ID (just digits, no dashes)
 * Could be searching for any rental ID containing these digits
 */
const isPartialRentalId = (input: string): boolean => {
  return /^\d+$/.test(input) && input.length >= 3
}

/**
 * Checks if input looks like an address
 * Addresses typically start with a letter and may contain numbers
 * Examples: "Kungsgatan", "Kungsgatan 5", "Västra vägen 12A"
 */
const isLikelyAddress = (input: string): boolean => {
  // Starts with letter (including Swedish chars)
  return /^[a-zA-ZåäöÅÄÖ]/.test(input)
}

/**
 * Checks if input contains numbers (useful for distinguishing address vs reason)
 */
const containsNumbers = (input: string): boolean => {
  return /\d/.test(input)
}

/**
 * Analyzes search term to determine optimal search strategy for rental blocks
 *
 * Rules:
 * - Digits with dashes (e.g., "101-001"): rental ID search with startsWith
 * - Pure digits (3+ chars): rental ID contains search
 * - Starts with letter + has numbers: likely address (e.g., "Kungsgatan 5")
 * - Letters only: search all fields (rentalId, address, blockReason)
 *
 * @param q The search query string
 * @returns Array of search targets with field and pattern
 */
export const analyzeRentalBlockSearchTerm = (
  q: string
): RentalBlockSearchTarget[] => {
  const trimmed = q.trim()
  const targets: RentalBlockSearchTarget[] = []

  if (!trimmed || trimmed.length < 2) {
    return targets
  }

  // Rental ID with dashes: "101-001-01" - search rental ID with startsWith
  if (isLikelyRentalId(trimmed) && trimmed.includes('-')) {
    targets.push({
      field: 'rentalId',
      pattern: trimmed,
      startsWith: true,
    })
    return targets
  }

  // Pure digits (3+): could be partial rental ID - search with contains
  if (isPartialRentalId(trimmed)) {
    targets.push({
      field: 'rentalId',
      pattern: trimmed,
      startsWith: false,
    })
    return targets
  }

  // Starts with letter and contains numbers: likely address
  // e.g., "Kungsgatan 5", "Västra 12"
  if (isLikelyAddress(trimmed) && containsNumbers(trimmed)) {
    targets.push({
      field: 'address',
      pattern: trimmed,
      startsWith: true,
    })
    // Also search rental ID in case it's something like "LGH-101"
    targets.push({
      field: 'rentalId',
      pattern: trimmed,
      startsWith: false,
    })
    return targets
  }

  // Letters only (no numbers): could be address, street name, or block reason
  // Search all three fields
  if (isLikelyAddress(trimmed) && !containsNumbers(trimmed)) {
    targets.push({
      field: 'address',
      pattern: trimmed,
      startsWith: true,
    })
    targets.push({
      field: 'blockReason',
      pattern: trimmed,
      startsWith: false,
    })
    // Also search rental ID for edge cases
    targets.push({
      field: 'rentalId',
      pattern: trimmed,
      startsWith: false,
    })
    return targets
  }

  // Default fallback: search all fields with contains
  targets.push({
    field: 'rentalId',
    pattern: trimmed,
    startsWith: false,
  })
  targets.push({
    field: 'address',
    pattern: trimmed,
    startsWith: false,
  })
  targets.push({
    field: 'blockReason',
    pattern: trimmed,
    startsWith: false,
  })

  return targets
}

/**
 * Helper to build SQL LIKE pattern from search target
 * @param target The search target
 * @returns SQL LIKE pattern string (without quotes - caller handles escaping)
 */
export const buildSqlLikePattern = (
  target: RentalBlockSearchTarget
): string => {
  if (target.startsWith) {
    return `${target.pattern}%`
  }
  return `%${target.pattern}%`
}

/**
 * Helper to determine Prisma operator from search target
 * @param target The search target
 * @returns Prisma string filter mode
 */
export const getPrismaOperator = (
  target: RentalBlockSearchTarget
): 'startsWith' | 'contains' => {
  return target.startsWith ? 'startsWith' : 'contains'
}
