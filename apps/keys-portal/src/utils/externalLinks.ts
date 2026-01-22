import { resolve } from '@/services/utils/env'

/**
 * Get the base URL for Alliera (DAX card management system)
 */
export function getAllieraBaseUrl(): string {
  return resolve(
    'VITE_ALLIERA_BASE_URL',
    'https://srvmimhk21.mimerbygg.local/Alliera'
  )
}

/**
 * Build a link to view a card owner in Alliera
 * @param cardOwnerId - The UUID of the card owner
 * @returns The full URL to the card owner's page in Alliera
 */
export function getCardOwnerLink(cardOwnerId: string): string {
  const baseUrl = getAllieraBaseUrl()
  return `${baseUrl}/Persons/Person/Show/${cardOwnerId}`
}

/**
 * Extract card owner ID from a card's owner object
 * The owner field is typed as unknown but contains cardOwnerId
 * @param owner - The owner object from CardDetails
 * @returns The card owner ID or null if not found
 */
export function extractCardOwnerId(owner: unknown): string | null {
  if (!owner || typeof owner !== 'object') {
    return null
  }

  const ownerObj = owner as Record<string, unknown>

  // Try cardOwnerId first (standard field)
  if (typeof ownerObj.cardOwnerId === 'string') {
    return ownerObj.cardOwnerId
  }

  // Fallback to id if present
  if (typeof ownerObj.id === 'string') {
    return ownerObj.id
  }

  return null
}
