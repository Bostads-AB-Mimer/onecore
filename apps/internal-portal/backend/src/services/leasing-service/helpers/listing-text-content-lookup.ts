import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import { AdapterResult } from '@/services/types'
import * as leasingCoreAdapter from '../adapters/core-adapter'
import * as propertyBaseCoreAdapter from '../../property-base-service/adapters/core-adapter'

// Mirrors the rental property type string produced by property-management's
// xpand-adapter for apartments (services/property-management/src/services/
// property-info-service/adapters/xpand-adapter.ts:44). Market-area listing
// texts exist for housing (apartments) only.
export const HOUSING_RENTAL_PROPERTY_TYPE = 'Lägenhet'

type ListingTextContentLookup = z.infer<
  typeof leasing.v1.ListingTextContentLookupSchema
>

export const getListingTextContentLookup = async (
  rentalObjectCode: string
): Promise<AdapterResult<ListingTextContentLookup, 'unknown'>> => {
  // Both depend only on the rental object code, so fetch them concurrently.
  const [contentResult, rentalPropertyResult] = await Promise.all([
    leasingCoreAdapter.getListingTextContentByRentalObjectCode(
      rentalObjectCode
    ),
    leasingCoreAdapter.getRentalPropertyByCode(rentalObjectCode),
  ])

  if (!contentResult.ok && contentResult.err === 'unknown') {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  const content = contentResult.ok ? contentResult.data : null
  const withoutMarketArea = (): AdapterResult<
    ListingTextContentLookup,
    'unknown'
  > => ({ ok: true, data: { content, marketArea: null, areaContent: null } })

  if (!rentalPropertyResult.ok) {
    if (rentalPropertyResult.err === 'not-found') {
      logger.info(
        { rentalObjectCode },
        'listing-text-content-lookup: rental property not found, skipping market area'
      )
    } else {
      // Not a data condition but an upstream failure (e.g. core down). The
      // editor still works without the area text, so degrade rather than fail.
      logger.error(
        { rentalObjectCode, err: rentalPropertyResult.err },
        'listing-text-content-lookup: failed to get rental property, skipping market area'
      )
    }
    return withoutMarketArea()
  }

  if (rentalPropertyResult.data.type !== HOUSING_RENTAL_PROPERTY_TYPE) {
    logger.info(
      { rentalObjectCode, type: rentalPropertyResult.data.type },
      'listing-text-content-lookup: rental property is not housing, skipping market area'
    )
    return withoutMarketArea()
  }

  const { property } = rentalPropertyResult.data
  // Narrow the ApartmentInfo | CommercialSpaceInfo | ParkingSpaceInfo union.
  // estateCode is typed as string but comes unguarded from Xpand
  // (babuf.fstcode), which can be NULL, so check the runtime type as well.
  const estateCode =
    'estateCode' in property && typeof property.estateCode === 'string'
      ? property.estateCode.trim()
      : ''
  if (!estateCode) {
    logger.info(
      { rentalObjectCode },
      'listing-text-content-lookup: rental property has no estateCode, skipping market area'
    )
    return withoutMarketArea()
  }

  const propertyDetailsResult =
    await propertyBaseCoreAdapter.getPropertyDetails(estateCode)

  if (!propertyDetailsResult.ok || !propertyDetailsResult.data.marketArea) {
    logger.info(
      { rentalObjectCode },
      'listing-text-content-lookup: property has no market area, skipping area text'
    )
    return withoutMarketArea()
  }

  const { marketArea } = propertyDetailsResult.data

  const areaContentResult =
    await leasingCoreAdapter.getListingAreaTextContentByMarketAreaCode(
      marketArea.code
    )

  let areaContent: ListingTextContentLookup['areaContent'] = null
  if (areaContentResult.ok) {
    areaContent = areaContentResult.data
  } else if (areaContentResult.err === 'unknown') {
    logger.error(
      { rentalObjectCode, marketAreaCode: marketArea.code },
      'listing-text-content-lookup: failed to get area text content'
    )
  }

  return {
    ok: true,
    data: {
      content,
      marketArea: { code: marketArea.code, name: marketArea.name },
      areaContent,
    },
  }
}
