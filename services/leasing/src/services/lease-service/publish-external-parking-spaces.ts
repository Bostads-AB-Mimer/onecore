/**
 * Service for publishing external (non-scored) parking spaces
 *
 * This service handles the publication of external parking spaces from the old system.
 * External parking spaces are identified by rentalObjectTypeCode: "POÄNGFRITT"
 */

import { logger } from '@onecore/utilities'
import { RentalObject, ListingStatus } from '@onecore/types'
import { Knex } from 'knex'

import * as rentalObjectAdapter from './adapters/xpand/rental-object-adapter'
import * as listingAdapter from './adapters/listing-adapter'
import { AdapterResult } from './adapters/types'

interface OldSystemParkingSpace {
  objectTypeCode: string
  objectTypeCaption: string
  realEstateObjectTypeCaption: string
  queuePoints: any[]
  numberOfApplications: number
  publishedFrom: string
  publishedTo: string | null
  rentalObjectCode: string
  rentalObjectTypeCode: string
  vacantFrom: string
  roomCount: number
  noApplyReasons: string[]
  postalAddress: string
  zipCode: string
  city: string
  size: string
  district: string
  districtCode: string
  block: string
  monthRent: string
  vatIncluded: string
  waitingListType: string
  elevatorExists: boolean
  buildingYear: number | null
  tags: string[]
  image: string
}

interface PublishResult {
  processed: number
  alreadyVacant: number
  notVacant: number
  created: number
  failed: number
  errors: Array<{ rentalObjectCode: string; error: string }>
}

type CreateListingData = {
  rentalObjectCode: string
  publishedFrom: Date
  publishedTo?: Date
  status: ListingStatus
  rentalRule: 'NON_SCORED'
  listingCategory: 'PARKING_SPACE'
}

/**
 * Gets all vacant parking spaces from the system
 *
 * @returns AdapterResult containing an array of vacant RentalObjects or an error
 */
export async function getVacantParkingSpaces(): Promise<
  AdapterResult<RentalObject[], 'unknown'>
> {
  try {
    // Call the rental object adapter to fetch vacant parking spaces from Xpand
    const result = await rentalObjectAdapter.getAllVacantParkingSpaces()

    if (!result.ok) {
      logger.error({ err: result.err }, 'Failed to fetch vacant parking spaces')
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: result.data }
  } catch (error) {
    logger.error({ error }, 'Error fetching vacant parking spaces')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Creates a listing for a parking space
 *
 * @param listingData - The listing data to create
 * @param db - Knex database connection
 * @returns AdapterResult with the created listing or an error code
 */
export async function createListing(
  listingData: CreateListingData,
  db: Knex
): Promise<AdapterResult<any, string>> {
  try {
    // Call the listing adapter to insert the listing into the database
    const result = await listingAdapter.createListing(listingData as any, db)

    if (!result.ok) {
      logger.error(
        { rentalObjectCode: listingData.rentalObjectCode, err: result.err },
        'Failed to create listing'
      )
      return { ok: false, err: result.err }
    }

    return { ok: true, data: result.data }
  } catch (error) {
    logger.error(
      { rentalObjectCode: listingData.rentalObjectCode, error },
      'Error creating listing'
    )
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Creates multiple listings in batch
 *
 * This method is more efficient than creating listings one by one.
 * If there are conflicts (e.g., duplicate listings), the adapter will handle
 * fallback to individual creation automatically.
 *
 * @param listingsData - Array of listing data to create
 * @param db - Knex database connection
 * @returns AdapterResult with created listings or error information
 */
export async function createMultipleListings(
  listingsData: CreateListingData[],
  db: Knex
): Promise<AdapterResult<any[], 'partial-failure' | 'unknown'>> {
  try {
    // Call the listing adapter to insert multiple listings in a single operation
    const result = await listingAdapter.createMultipleListings(
      listingsData as any,
      db
    )

    if (!result.ok) {
      // On partial failure, try to get individual results to report accurately
      if (result.err === 'partial-failure') {
        logger.info(
          { attempted: listingsData.length },
          'Partial failure detected, trying individual creation to track successes'
        )

        // Retry with individual creation to track which ones succeeded
        const individualResults = await Promise.allSettled(
          listingsData.map((listingData) =>
            listingAdapter.createListing(listingData as any, db)
          )
        )

        const successfulListings: any[] = []
        individualResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.ok) {
            successfulListings.push(result.value.data)
          }
        })

        // Return success with the listings that were created
        // Even if none were created (all duplicates), this is not an error
        return { ok: true, data: successfulListings }
      }

      logger.error({ err: result.err }, 'Failed to create multiple listings')
      return { ok: false, err: result.err }
    }

    return { ok: true, data: result.data }
  } catch (error) {
    logger.error({ error }, 'Error creating multiple listings')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Publishes external parking spaces from the old system
 *
 * This function compares parking spaces from the old system with vacant parking spaces
 * in our system by rentalObjectCode. Only parking spaces that:
 * 1. Have rentalObjectTypeCode: "POÄNGFRITT" in the old system
 * 2. Have a matching rentalObjectCode in our system's vacant parking spaces
 *
 * ...will get NON_SCORED listings created.
 *
 * @param oldSystemSpaces - Array of parking spaces from the old system
 * @param db - Knex database connection
 * @returns PublishResult with statistics about the publication process
 */
export async function publishExternalParkingSpaces(
  oldSystemSpaces: OldSystemParkingSpace[],
  db: Knex
): Promise<PublishResult> {
  // Initialize result tracking object to keep statistics
  const result: PublishResult = {
    processed: 0,
    alreadyVacant: 0,
    notVacant: 0,
    created: 0,
    failed: 0,
    errors: [],
  }

  // Step 1: Filter the old system data to keep only external parking spaces
  // External parking spaces are identified by rentalObjectTypeCode: "POÄNGFRITT"
  const externalSpaces = oldSystemSpaces.filter(
    (space) => space.rentalObjectTypeCode === 'POÄNGFRITT'
  )

  logger.info(
    {
      externalCount: externalSpaces.length,
      totalCount: oldSystemSpaces.length,
    },
    'Found external parking spaces (POÄNGFRITT)'
  )

  // Step 2: Fetch all vacant parking spaces from our system
  // These are the parking spaces that are currently available for rent
  const vacantSpacesResult = await getVacantParkingSpaces()

  if (!vacantSpacesResult.ok) {
    logger.error('Failed to fetch vacant parking spaces')
    throw new Error('Failed to fetch vacant parking spaces from system')
  }

  const vacantSpaces = vacantSpacesResult.data

  // Step 3: Create a Set of vacant parking space codes for fast lookup
  // This allows us to quickly check if a parking space from the old system exists in our system
  const vacantSpacesCodes = new Set(
    vacantSpaces.map((space) => space.rentalObjectCode)
  )

  logger.info(
    { count: vacantSpaces.length },
    'Found vacant parking spaces in system'
  )

  // Step 4: Prepare array to collect all listings that should be created
  const listingsToCreate: CreateListingData[] = []

  // Step 5: Iterate through each external parking space from the old system
  for (const space of externalSpaces) {
    result.processed++

    // Step 6: Check if this parking space exists in our vacant parking spaces
    // We compare by rentalObjectCode - only create listing if it exists in both systems
    if (!vacantSpacesCodes.has(space.rentalObjectCode)) {
      result.notVacant++
      logger.warn(
        { rentalObjectCode: space.rentalObjectCode },
        'Parking space from old system not found in vacant parking spaces, skipping'
      )
      continue
    }

    // This parking space exists in both systems and is vacant
    result.alreadyVacant++

    // Step 7: Prepare the listing data object
    const listingData: CreateListingData = {
      rentalObjectCode: space.rentalObjectCode,
      publishedFrom: new Date(space.publishedFrom),
      status: ListingStatus.Active,
      rentalRule: 'NON_SCORED', // External parking spaces are non-scored (first come, first served)
      listingCategory: 'PARKING_SPACE',
    }

    // Step 8: Add publishedTo date if it exists in the old system data
    // publishedTo is optional and defines when the listing should expire
    if (space.publishedTo) {
      listingData.publishedTo = new Date(space.publishedTo)
    }

    // Add this listing to the batch to be created
    listingsToCreate.push(listingData)
  }

  // Step 9: Create all listings in batch for better performance
  if (listingsToCreate.length > 0) {
    logger.info(
      { count: listingsToCreate.length },
      'Creating listings in batch'
    )

    // Call the listing adapter to create multiple listings at once
    const batchResult = await createMultipleListings(listingsToCreate, db)

    // Step 10: Process the batch creation result and update statistics
    if (batchResult.ok) {
      // Listings were created successfully (all or partial)
      result.created = batchResult.data.length
      result.failed = listingsToCreate.length - result.created

      if (result.failed > 0) {
        logger.warn(
          { created: result.created, failed: result.failed },
          'Partial success - some listings already exist or failed'
        )
      } else {
        logger.info(
          { count: result.created },
          'Successfully created all listings'
        )
      }
    } else {
      // Total failure - all listings failed to be created
      result.failed = listingsToCreate.length
      result.errors.push({
        rentalObjectCode: 'batch',
        error: batchResult.err,
      })
      logger.error(
        { err: batchResult.err },
        'Failed to create listings in batch'
      )
    }
  }

  // Step 11: Return the final result with all statistics
  return result
}

export type { OldSystemParkingSpace, PublishResult, CreateListingData }
