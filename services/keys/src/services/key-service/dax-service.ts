import { logger } from '@onecore/utilities'
import * as cardOwnersAdapter from './adapters/card-owners-adapter'
// Using TEST DAX adapter with REAL OAuth + detailed logging
import * as testDaxAdapter from './adapters/test-dax-adapter'

/**
 * DAX Service
 * Business logic layer for DAX API operations
 * Using TEST DAX adapter with real OAuth and detailed logging
 */

/**
 * Get all contracts from DAX
 * Using TEST DAX adapter with OAuth + correct RSA signature + detailed logging
 */
export async function getAllContracts() {
  try {
    logger.info('Fetching contracts from DAX (USING TEST DAX ADAPTER WITH REAL OAUTH)')
    const response = await testDaxAdapter.getContracts()
    return response.contracts || []
  } catch (error) {
    logger.error({ error }, 'Failed to get contracts from DAX')
    throw error
  }
}

/**
 * Get a specific card owner by ID
 * Uses .NET CLI wrapper for reliable API access
 */
export async function getCardOwnerById(cardOwnerId: string) {
  try {
    const cardOwner = await cardOwnersAdapter.getCardOwner(cardOwnerId)
    return cardOwner
  } catch (error) {
    logger.error({ error, cardOwnerId }, 'Failed to get card owner from DAX')
    throw error
  }
}

/**
 * Search for card owners
 * Card owners are identified by name (familyName) which corresponds to rental object ID (object code)
 * Now uses DAX API's nameFilter for efficient server-side filtering
 */
export async function searchCardOwners(params: {
  name?: string // Rental object ID / object code
  offset?: number
  limit?: number
}) {
  try {
    // Use the new searchCardOwners adapter that applies nameFilter at API level
    const cardOwners = await cardOwnersAdapter.searchCardOwners(params.name)

    // Apply client-side pagination if requested
    if (params.offset !== undefined || params.limit !== undefined) {
      const offset = params.offset || 0
      const limit = params.limit || cardOwners.length
      return cardOwners.slice(offset, offset + limit)
    }

    return cardOwners
  } catch (error) {
    logger.error({ error, params }, 'Failed to search card owners from DAX')
    throw error
  }
}
