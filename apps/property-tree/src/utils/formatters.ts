/**
 * Generates an author abbreviation from a full name
 * Takes first 3 letters of first name and first 3 letters of last name
 *
 * Examples:
 * - "David Lindblom" → "DAVLIN"
 * - "Anna Svensson" → "ANNSVE"
 * - "Bo" → "BO"
 * - "Carl Gustav" → "CARGUS"
 *
 * @param fullName - The full name to abbreviate
 * @returns Uppercase abbreviation (max 6 characters)
 */
export function generateAuthorAbbreviation(fullName: string): string {
  if (!fullName || fullName.trim() === '') {
    return ''
  }

  const nameParts = fullName.trim().split(/\s+/)

  if (nameParts.length === 0) {
    return ''
  }

  if (nameParts.length === 1) {
    // Only one name part, return up to 6 characters
    return nameParts[0].substring(0, 6).toUpperCase()
  }

  // Take first 3 letters of first name and first 3 letters of last name
  const firstName = nameParts[0].substring(0, 3)
  const lastName = nameParts[nameParts.length - 1].substring(0, 3)

  return (firstName + lastName).toUpperCase()
}

export const formatISODate = (isoDateString: string | null | undefined) => {
  if (!isoDateString) return '-'
  const date = new Date(isoDateString)
  return date.toLocaleDateString('sv-SE')
}
