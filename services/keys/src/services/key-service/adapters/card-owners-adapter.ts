import { logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import Config from '../../../common/config'
import { getCardOwnerCli, searchCardOwnersCli } from './dax-cli-wrapper'

type CardOwner = keys.v1.CardOwner
type GetCardOwnersResponse = keys.v1.GetCardOwnersResponse
type GetCardOwnerResponse = keys.v1.GetCardOwnerResponse

/**
 * Card Owners Adapter
 * Fetches card owners and their cards from DAX API using the .NET CLI wrapper
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

    logger.info(`Fetching card owner ${cardOwnerId}`)

    const response = (await getCardOwnerCli(
      partnerId,
      instanceId,
      cardOwnerId
    )) as GetCardOwnerResponse

    return response.CardOwner
  } catch (error) {
    logger.error({ error, cardOwnerId }, `Failed to fetch card owner ${cardOwnerId}`)
    return null
  }
}

/**
 * Search card owners by name (rental object ID)
 * Uses nameFilter to efficiently search at the API level
 * If nameFilter is not provided, returns all card owners (up to default limit of 50)
 */
export async function searchCardOwners(nameFilter?: string): Promise<CardOwner[]> {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(`Searching card owners with nameFilter: ${nameFilter || 'none (all)'}`)

    const response = (await searchCardOwnersCli(
      partnerId,
      instanceId,
      nameFilter, // nameFilter
      'cards' // expand to include cards
    )) as GetCardOwnersResponse

    logger.info(`Found ${response.CardOwners.length} card owners`)

    return response.CardOwners
  } catch (error) {
    logger.error({ error, nameFilter }, 'Failed to search card owners')
    throw error
  }
}
