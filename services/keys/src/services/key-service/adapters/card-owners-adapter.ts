import { logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import Config from '../../../common/config'
// TEMPORARY: Using direct TypeScript adapter for testing
import * as daxAdapter from './dax-adapter'

type CardOwner = keys.v1.CardOwner
type GetCardOwnersResponse = keys.v1.GetCardOwnersResponse
type GetCardOwnerResponse = keys.v1.GetCardOwnerResponse

/**
 * Card Owners Adapter
 * TEMPORARY: Using direct TypeScript DAX adapter for comparison testing
 */

/**
 * Get a specific card owner by ID
 */
export async function getCardOwner(
  cardOwnerId: string
): Promise<CardOwner | null> {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(`Fetching card owner ${cardOwnerId} (USING DIRECT TS ADAPTER)`)

    const response = await daxAdapter.getCardOwner(
      partnerId,
      instanceId,
      cardOwnerId
    )

    return response.cardOwner as any // Type mismatch, but close enough for testing
  } catch (error) {
    logger.error(
      { error, cardOwnerId },
      `Failed to fetch card owner ${cardOwnerId}`
    )
    return null
  }
}

/**
 * Search card owners by name (rental object ID)
 * TEMPORARY: Using queryCardOwners with firstname/lastname for testing
 */
export async function searchCardOwners(
  nameFilter?: string
): Promise<CardOwner[]> {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(
      `Searching card owners with nameFilter: ${nameFilter || 'none (all)'} (USING DIRECT TS ADAPTER)`
    )

    // Use the query endpoint with name filter
    const response = await daxAdapter.queryCardOwners({
      partnerId,
      instanceId,
      firstname: nameFilter,
      limit: 50,
    })

    logger.info(`Found ${response.cardOwners.length} card owners`)

    return response.cardOwners as any // Type mismatch, but close enough for testing
  } catch (error) {
    logger.error({ error, nameFilter }, 'Failed to search card owners')
    throw error
  }
}
