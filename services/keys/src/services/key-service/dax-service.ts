import { logger } from '@onecore/utilities'
import * as cardOwnersAdapter from './adapters/card-owners-adapter'
import { getContractsCli } from './adapters/dax-cli-wrapper'

/**
 * DAX Service
 * Business logic layer for DAX API operations
 * Uses .NET CLI wrapper for reliable API access
 */

/**
 * Get all contracts from DAX
 * Uses .NET CLI wrapper for reliable API access
 */
export async function getAllContracts() {
  try {
    const response = (await getContractsCli()) as any
    return response.Contracts || []
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
 * Card owners are identified by familyName which corresponds to rental object ID (object code)
 */
export async function searchCardOwners(params: {
  familyName?: string // Rental object ID / object code
  offset?: number
  limit?: number
}) {
  try {
    const allCardOwners = await cardOwnersAdapter.getAllCardOwners()

    let filtered = allCardOwners
    if (params.familyName) {
      filtered = filtered.filter((co) =>
        co.familyName?.toLowerCase().includes(params.familyName!.toLowerCase())
      )
    }

    // Apply pagination only if specified
    if (params.offset !== undefined || params.limit !== undefined) {
      const offset = params.offset || 0
      const limit = params.limit || filtered.length
      return filtered.slice(offset, offset + limit)
    }

    return filtered
  } catch (error) {
    logger.error({ error, params }, 'Failed to search card owners from DAX')
    throw error
  }
}
