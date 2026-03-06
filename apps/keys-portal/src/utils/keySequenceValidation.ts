import { keyService } from '@/services/api/keyService'

/**
 * Result of parsing sequence number input
 */
export interface SequenceNumberValidation {
  isValid: boolean
  numbers: number[]
  error?: string
}

/**
 * Parse and validate sequence number input from user
 * Supports single numbers (e.g., "5") or ranges (e.g., "1-10")
 *
 * @param input - User input string (e.g., "5" or "1-10")
 * @returns Validation result with array of numbers or error message
 *
 * @example
 * parseSequenceNumberInput("5") // { isValid: true, numbers: [5] }
 * parseSequenceNumberInput("1-10") // { isValid: true, numbers: [1,2,3,4,5,6,7,8,9,10] }
 * parseSequenceNumberInput("0-5") // { isValid: false, error: "..." }
 */
export function parseSequenceNumberInput(
  input: string
): SequenceNumberValidation {
  // Empty input is valid (optional field)
  if (!input || input.trim() === '') {
    return { isValid: true, numbers: [] }
  }

  const trimmed = input.trim()

  // Check if it's a range (contains hyphen)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-')
    if (parts.length !== 2) {
      return {
        isValid: false,
        numbers: [],
        error: 'Ogiltigt format. Använd format: 1-10',
      }
    }

    const start = parseInt(parts[0], 10)
    const end = parseInt(parts[1], 10)

    if (isNaN(start) || isNaN(end)) {
      return {
        isValid: false,
        numbers: [],
        error: 'Ogiltiga nummer i intervallet',
      }
    }

    if (start < 1) {
      return {
        isValid: false,
        numbers: [],
        error: 'Startnummer måste vara minst 1',
      }
    }

    if (start > end) {
      return {
        isValid: false,
        numbers: [],
        error: 'Startnummer måste vara mindre än eller lika med slutnummer',
      }
    }

    if (start === end) {
      return {
        isValid: false,
        numbers: [],
        error: 'För samma nummer, skriv bara ett nummer (t.ex. 10)',
      }
    }

    const count = end - start + 1
    if (count > 20) {
      return {
        isValid: false,
        numbers: [],
        error: `Du kan bara skapa max 20 nycklar åt gången (du försökte skapa ${count} nycklar)`,
      }
    }

    // Generate array of numbers
    const numbers = Array.from({ length: count }, (_, i) => start + i)
    return { isValid: true, numbers }
  }

  // Single number
  const num = parseInt(trimmed, 10)
  if (isNaN(num)) {
    return {
      isValid: false,
      numbers: [],
      error: 'Ogiltigt nummer',
    }
  }

  if (num < 1) {
    return {
      isValid: false,
      numbers: [],
      error: 'Löpnummer måste vara minst 1',
    }
  }

  return { isValid: true, numbers: [num] }
}

/**
 * Check for existing keys with same name, sequence number, and key system
 * Only checks non-disposed keys (disposed keys can be replaced)
 *
 * @param keyName - The key name to check
 * @param sequenceNumbers - Array of sequence numbers to check
 * @param keySystemId - The key system ID to check against
 * @returns Array of sequence numbers that already exist (duplicates)
 *
 * @example
 * // Returns [3, 5] if keys with sequence 3 and 5 already exist
 * await checkForDuplicates("Mkey", [1,2,3,4,5], "xxx123")
 */
export async function checkForDuplicates(
  keyName: string,
  sequenceNumbers: number[],
  keySystemId: string | undefined
): Promise<number[]> {
  // If no sequence numbers or no key system, can't have duplicates
  if (sequenceNumbers.length === 0 || !keySystemId) {
    return []
  }

  try {
    // Search for existing keys with same name and key system
    // Only check non-disposed keys (disposed keys can be replaced)
    const response = await keyService.searchKeys(
      {
        keyName,
        keySystemId,
        disposed: 'false', // Only check non-disposed keys
      },
      1,
      1000 // Get all matching keys
    )

    // Extract existing sequence numbers from non-disposed keys
    const existingSequenceNumbers = response.content
      .filter(
        (key) =>
          key.keySequenceNumber !== null && key.keySequenceNumber !== undefined
      )
      .map((key) => key.keySequenceNumber as number)

    // Find duplicates - sequence numbers that already exist in non-disposed keys
    const duplicates = sequenceNumbers.filter((seqNum) =>
      existingSequenceNumbers.includes(seqNum)
    )

    return duplicates
  } catch (error) {
    console.error('Error checking for duplicates:', error)
    // If error, return empty array to allow creation (fail open)
    return []
  }
}
