import { logger } from '@onecore/utilities'
// Using standalone dax-client library
import * as daxAdapter from './adapters/dax-client-adapter'
import Config from '../../common/config'

/**
 * DAX Service
 * Business logic layer for DAX API operations
 * Using standalone dax-client library
 */

/**
 * Get all contracts from DAX
 * Using standalone dax-client library
 */
export async function getAllContracts() {
  try {
    logger.info('Fetching contracts from DAX (using dax-client library)')
    const response = await daxAdapter.getContracts()
    return response.contracts || []
  } catch (error) {
    logger.error({ error }, 'Failed to get contracts from DAX')
    throw error
  }
}

/**
 * Get a specific card owner by ID
 */
export async function getCardOwnerById(cardOwnerId: string, expand?: string) {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(`Fetching card owner ${cardOwnerId}`)
    const response = await daxAdapter.getCardOwner(
      partnerId,
      instanceId,
      cardOwnerId,
      expand
    )
    return response.cardOwner
  } catch (error) {
    logger.error({ error, cardOwnerId }, 'Failed to get card owner from DAX')
    throw error
  }
}

/**
 * Get a specific card by ID
 */
export async function getCardById(cardId: string, expand?: string) {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(`Fetching card ${cardId}`)
    const response = await daxAdapter.getCard(
      partnerId,
      instanceId,
      cardId,
      expand
    )
    return response.card
  } catch (error) {
    logger.error({ error, cardId }, 'Failed to get card from DAX')
    throw error
  }
}

/**
 * Search for card owners
 * Card owners are identified by name (familyName) which corresponds to rental object ID (object code)
 * Now uses DAX API's nameFilter for efficient server-side filtering
 */
export async function searchCardOwners(params: {
  nameFilter?: string
  offset?: number
  limit?: number
  expand?: string
  idfilter?: string
  attributeFilter?: string
  selectedAttributes?: string
  folderFilter?: string
  organisationFilter?: string
}) {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    // Extract client-side pagination params
    const { offset, limit, ...queryParams } = params

    logger.info({ params }, 'Searching card owners')
    const response = await daxAdapter.queryCardOwners({
      owningPartnerId: partnerId,
      owningInstanceId: instanceId,
      ...queryParams,
    })

    const cardOwners = response.cardOwners

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
