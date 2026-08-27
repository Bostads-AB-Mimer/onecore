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
  const contentResult =
    await leasingCoreAdapter.getListingTextContentByRentalObjectCode(
      rentalObjectCode
    )

  if (!contentResult.ok && contentResult.err === 'unknown') {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  const content = contentResult.ok ? contentResult.data : null

  const rentalPropertyResult =
    await leasingCoreAdapter.getRentalPropertyByCode(rentalObjectCode)

  if (!rentalPropertyResult.ok) {
    logger.info(
      { rentalObjectCode },
      'listing-text-content-lookup: rental property not found, skipping market area'
    )
    return { ok: true, data: { content, marketArea: null, areaContent: null } }
  }

  if (rentalPropertyResult.data.type !== HOUSING_RENTAL_PROPERTY_TYPE) {
    logger.info(
      { rentalObjectCode, type: rentalPropertyResult.data.type },
      'listing-text-content-lookup: rental property is not housing, skipping market area'
    )
    return { ok: true, data: { content, marketArea: null, areaContent: null } }
  }

  const { property } = rentalPropertyResult.data
  if (!('estateCode' in property) || !property.estateCode.trim()) {
    // Housing rental properties always carry an estateCode; narrow the
    // ApartmentInfo | CommercialSpaceInfo | ParkingSpaceInfo union.
    logger.info(
      { rentalObjectCode },
      'listing-text-content-lookup: rental property has no estateCode, skipping market area'
    )
    return { ok: true, data: { content, marketArea: null, areaContent: null } }
  }

  const propertyDetailsResult =
    await propertyBaseCoreAdapter.getPropertyDetails(property.estateCode)

  if (!propertyDetailsResult.ok || !propertyDetailsResult.data.marketArea) {
    logger.info(
      { rentalObjectCode },
      'listing-text-content-lookup: property has no market area, skipping area text'
    )
    return { ok: true, data: { content, marketArea: null, areaContent: null } }
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
