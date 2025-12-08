import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import { getCardOwnersCli, getCardOwnerCli } from './dax-cli-wrapper'

/**
 * Card Owners Adapter
 * Fetches card owners and their cards from DAX API using the .NET CLI wrapper
 */

export interface CardOwner {
  cardOwnerId: string
  cardOwnerType: string
  familyName: string
  specificName: string
  primaryOrganization: string | null
  cards: Card[]
  comment: string
  disabled: boolean
  startTime: string | null
  stopTime: string | null
  pinCode: string
  attributes: any
  state: string
  archivedAt: string | null
  createTime: string
}

export interface Card {
  cardId: string
  cardNumber: string
  cardType: string
  validFrom: string
  validTo: string | null
  state: string
  issuedAt: string
  revokedAt: string | null
}

export interface GetCardOwnersResponse {
  CardOwners: CardOwner[]
}

export interface GetCardOwnerResponse {
  CardOwner: CardOwner
}

/**
 * Get all card owners for a specific rental object (using partner + instance)
 * @param rentalObjectId - The rental object ID (used to look up partner/instance)
 */
export async function getCardOwnersForRentalObject(
  rentalObjectId: string
): Promise<CardOwner[]> {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info(
      `Fetching card owners for rental object ${rentalObjectId} (partner: ${partnerId}, instance: ${instanceId})`
    )

    const response = (await getCardOwnersCli(
      partnerId,
      instanceId
    )) as GetCardOwnersResponse

    // Filter card owners by rental object ID (familyName matches rentalObjectId)
    const matchingCardOwners = response.CardOwners.filter(
      (co) => co.familyName === rentalObjectId
    )

    logger.info(
      `Found ${matchingCardOwners.length} card owners for rental object ${rentalObjectId}`
    )

    return matchingCardOwners
  } catch (error) {
    logger.error({ error, rentalObjectId }, `Failed to fetch card owners for rental object ${rentalObjectId}`)
    throw error
  }
}

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
 * Get all card owners (no filtering)
 */
export async function getAllCardOwners(): Promise<CardOwner[]> {
  try {
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    logger.info('Fetching all card owners')

    const response = (await getCardOwnersCli(
      partnerId,
      instanceId
    )) as GetCardOwnersResponse

    logger.info(`Found ${response.CardOwners.length} total card owners`)

    return response.CardOwners
  } catch (error) {
    logger.error({ error }, 'Failed to fetch card owners')
    throw error
  }
}

/**
 * Get cards for a specific rental object
 * This is a convenience method that fetches card owners and extracts their cards
 */
export async function getCardsForRentalObject(
  rentalObjectId: string
): Promise<Card[]> {
  const cardOwners = await getCardOwnersForRentalObject(rentalObjectId)

  // Flatten all cards from all matching card owners
  const cards = cardOwners.flatMap((co) => co.cards)

  logger.info(`Found ${cards.length} total cards for rental object ${rentalObjectId}`)

  return cards
}
