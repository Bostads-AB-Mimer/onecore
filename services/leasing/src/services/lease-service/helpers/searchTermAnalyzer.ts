/**
 * Search term analyzer for lease search
 * Determines which columns to search based on input pattern
 */

export interface SearchTarget {
  column: string
  pattern: string
  /** If true, search term should be normalized (spaces/dashes removed) */
  normalizeInput?: boolean
}

/**
 * Normalizes a personal number by removing spaces and dashes
 * "19850101-1234" -> "198501011234"
 * "850101 1234" -> "8501011234"
 */
export const normalizePersonalNumber = (input: string): string => {
  return input.replace(/[\s-]/g, '')
}

/**
 * Checks if input looks like a personal number (all digits after normalization)
 */
const isLikelyPersonalNumber = (input: string): boolean => {
  const normalized = normalizePersonalNumber(input)
  return /^\d+$/.test(normalized) && normalized.length >= 4
}

/**
 * Checks if input is a contact code (F,I,K,L,Ö,P,S followed by numbers)
 */
const isContactCode = (input: string): boolean => {
  return /^[FIKLÖPSfiklöps]\d+$/.test(input)
}

/**
 * Checks if input starts with a letter
 */
const startsWithLetter = (input: string): boolean => {
  return /^[a-zA-ZåäöÅÄÖ]/.test(input)
}

/**
 * Checks if input contains any digits
 */
const containsNumbers = (input: string): boolean => {
  return /\d/.test(input)
}

/**
 * Analyzes search term to determine which columns to search
 * Returns optimized search targets based on input pattern
 *
 * Rules:
 * - Contact code (F/I/K/L/Ö/P/S + numbers): search cmctckod only, trailing wildcard
 * - All numbers (or numbers with spaces/dashes): search persorgnr only, normalized
 * - Letters only: search name + address (trailing wildcard for address)
 * - Letters + numbers (not contact code): likely address
 */
export const analyzeSearchTerm = (q: string): SearchTarget[] => {
  const trimmed = q.trim()
  const targets: SearchTarget[] = []

  // Contact code: starts with F,I,K,L,Ö,P,S followed by numbers only
  if (isContactCode(trimmed)) {
    targets.push({ column: 'cmctc.cmctckod', pattern: `${trimmed}%` })
    return targets
  }

  // Looks like a personal number (digits, possibly with spaces/dashes)
  if (isLikelyPersonalNumber(trimmed)) {
    const normalized = normalizePersonalNumber(trimmed)
    targets.push({
      column: 'cmctc.persorgnr',
      pattern: `%${normalized}%`,
      normalizeInput: true,
    })
    return targets
  }

  // Starts with letter, no numbers: likely name or address
  if (startsWithLetter(trimmed) && !containsNumbers(trimmed)) {
    targets.push({ column: 'cmctc.cmctcben', pattern: `%${trimmed}%` })
    targets.push({ column: 'cmadr.adress1', pattern: `${trimmed}%` }) // Address: trailing wildcard
    targets.push({ column: 'hyobj.hyobjben', pattern: `%${trimmed}%` }) // Lease ID
    return targets
  }

  // Mixed (letters + numbers, not contact code): likely address or lease ID
  // Also serves as default for any unmatched patterns
  targets.push({ column: 'cmadr.adress1', pattern: `${trimmed}%` }) // Address: trailing wildcard
  targets.push({ column: 'hyobj.hyobjben', pattern: `%${trimmed}%` }) // Lease ID

  return targets
}