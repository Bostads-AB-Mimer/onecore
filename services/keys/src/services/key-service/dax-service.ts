import { logger } from '@onecore/utilities'
import * as daxAdapter from './adapters/dax-adapter'

/**
 * DAX Service
 * Business logic layer for DAX API operations
 */

/**
 * Get all contracts from DAX
 */
export async function getAllContracts() {
  try {
    const response = await daxAdapter.getContracts()
    return response.contracts
  } catch (error) {
    logger.error({ error }, 'Failed to get contracts from DAX')
    throw error
  }
}

/**
 * Get a specific card owner by ID
 */
export async function getCardOwnerById(
  partnerId: string,
  instanceId: string,
  cardOwnerId: string
) {
  try {
    const response = await daxAdapter.getCardOwner(
      partnerId,
      instanceId,
      cardOwnerId
    )
    return response.cardOwner
  } catch (error) {
    logger.error({ error, cardOwnerId }, 'Failed to get card owner from DAX')
    throw error
  }
}

/**
 * Search for card owners
 */
export async function searchCardOwners(params: {
  firstname?: string
  lastname?: string
  email?: string
  personnummer?: string
  offset?: number
  limit?: number
}) {
  try {
    const response = await daxAdapter.queryCardOwners(params)
    return response.cardOwners
  } catch (error) {
    logger.error({ error, params }, 'Failed to search card owners from DAX')
    throw error
  }
}
