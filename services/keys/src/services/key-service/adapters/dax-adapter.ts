/**
 * DAX Adapter
 * Single adapter for all DAX API operations.
 * Uses the dax-client library and handles config internally.
 */

import {
  createDaxClient,
  type Contract,
  type CardOwner,
  type Card,
  type CardOwnerQueryParams,
} from 'dax-client'
import { logger } from '@onecore/utilities'
import Config from '../../../common/config'

// Singleton client instance
let clientInstance: ReturnType<typeof createDaxClient> | null = null

function getClient() {
  if (!clientInstance) {
    clientInstance = createDaxClient({
      apiUrl: Config.alliera.apiUrl,
      clientId: Config.alliera.clientId,
      username: Config.alliera.username,
      password: Config.alliera.password,
      privateKey: Config.alliera.pemKey,
      apiVersion: '2.0',
      partnerId: Config.alliera.partnerId,
      instanceId: Config.alliera.owningInstanceId,
    })
  }

  return clientInstance
}

// ---- Contracts ----

export async function getContracts(): Promise<Contract[]> {
  try {
    logger.info('Fetching contracts from DAX')
    const response = await getClient().contracts.getAll()
    return response.contracts || []
  } catch (error) {
    logger.error({ error }, 'Failed to get contracts from DAX')
    throw error
  }
}

// ---- Card Owners ----

export async function getCardOwnerById(
  cardOwnerId: string,
  expand?: string
): Promise<CardOwner> {
  try {
    logger.info({ cardOwnerId }, 'Fetching card owner from DAX')
    const response = await getClient().cardOwners.getById(cardOwnerId, expand)
    return response.cardOwner
  } catch (error) {
    logger.error({ error, cardOwnerId }, 'Failed to get card owner from DAX')
    throw error
  }
}

/**
 * Query card owners. offset/limit are forwarded to DAX (default limit 50, max 200).
 */
export async function searchCardOwners(
  params: CardOwnerQueryParams
): Promise<CardOwner[]> {
  try {
    logger.info({ params }, 'Searching card owners in DAX')
    const response = await getClient().cardOwners.query(params)
    return response.cardOwners
  } catch (error) {
    logger.error({ error, params }, 'Failed to search card owners from DAX')
    throw error
  }
}

// ---- Cards ----

export async function getCardById(
  cardId: string,
  expand?: string
): Promise<Card> {
  try {
    logger.info({ cardId }, 'Fetching card from DAX')
    const response = await getClient().cards.getById(cardId, expand)
    return response.card
  } catch (error) {
    logger.error({ error, cardId }, 'Failed to get card from DAX')
    throw error
  }
}
