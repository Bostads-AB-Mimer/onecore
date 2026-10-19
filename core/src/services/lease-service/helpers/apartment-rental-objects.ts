import {
  property,
  RentalObject,
  RentalObjectAvailabilityInfo,
} from '@onecore/types'
import { determineVacantFrom, logger } from '@onecore/utilities'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import { AdapterResult } from '../../../adapters/types'
import { governingBlock } from './rental-blocks'

// Property's batch routes take at most 5000 rental ids per request.
const PROPERTY_BATCH_SIZE = 5000

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Every item of every batch, or an error if any batch failed. */
const inBatches = async <T>(
  codes: string[],
  fetch: (rentalIds: string[]) => Promise<AdapterResult<T[], unknown>>
): Promise<AdapterResult<T[], 'unknown'>> => {
  const results = await Promise.all(
    chunk(codes, PROPERTY_BATCH_SIZE).map((rentalIds) => fetch(rentalIds))
  )
  const items: T[] = []
  for (const result of results) {
    if (!result.ok) return { ok: false, err: 'unknown' }
    items.push(...result.data)
  }
  return { ok: true, data: items }
}

const getLeaseAvailabilities = async (
  codes: string[]
): Promise<Map<string, RentalObjectAvailabilityInfo>> => {
  const result = await leasingAdapter.getLeaseAvailabilities(codes)
  // Without lease data the apartments are still listed, just without rent and
  // vacancy (as a single parking space is; the parking space list fails
  // instead). Listing pages can show the rest of the object meanwhile.
  // Codes the leases don't know are simply absent from the result.
  if (!result.ok) {
    logger.error({ codes }, 'Could not get lease availabilities for apartments')
    return new Map()
  }
  return new Map(result.data.map((info) => [info.rentalObjectCode, info]))
}

const toRentalObject = (
  residence: property.ResidenceBatchItem,
  blocks: property.RentalBlock[],
  availability: RentalObjectAvailabilityInfo | undefined
): RentalObject => {
  const block = governingBlock(blocks)
  return {
    rentalObjectCode: residence.rentalId,
    address: residence.address?.street ?? '',
    propertyCode: residence.property?.code,
    propertyCaption: residence.property?.name ?? undefined,
    residentialAreaCode: residence.marketArea?.code ?? '',
    residentialAreaCaption: residence.marketArea?.name ?? '',
    objectTypeCode: residence.residenceType?.code ?? '',
    objectTypeCaption: residence.residenceType?.name ?? '',
    boaArea: residence.area ?? undefined,
    floor: residence.floor ?? undefined,
    roomCount: residence.residenceType?.roomCount ?? undefined,
    blockStartDate: block?.fromDate,
    blockEndDate: block?.toDate ?? undefined,
    availabilityInfo: availability && {
      ...availability,
      vacantFrom: determineVacantFrom(
        availability.vacantFrom,
        block?.fromDate,
        block?.toDate
      ),
    },
  }
}

/**
 * Apartments by rental object code. The object comes from property's
 * residence batch, its open blocks from the block batch, and rent, vacancy,
 * rental tenure type and tags from the leases; vacantFrom is adjusted for
 * blocks with the same rule as parking spaces. Codes that aren't apartments
 * are left out. A failed property lookup, objects or blocks, is an error: a
 * wrong vacantFrom is worse than none. A failed lease lookup is not, see
 * getLeaseAvailabilities.
 *
 * No filtering on rental type here: these are the objects of existing
 * listings. Which apartments are listed in OneCore at all (not student
 * apartments, whose leases are made by hand in Tenfast) is decided when
 * listings are published.
 */
export const getApartments = async (
  rentalObjectCodes: string[]
): Promise<AdapterResult<RentalObject[], 'unknown'>> => {
  const codes = [...new Set(rentalObjectCodes)]
  if (codes.length === 0) return { ok: true, data: [] }

  const [residences, blocks, availabilities] = await Promise.all([
    inBatches(codes, propertyBaseAdapter.getResidencesBatch),
    inBatches(codes, propertyBaseAdapter.getRentalBlocksBatch),
    getLeaseAvailabilities(codes),
  ])
  if (!residences.ok || !blocks.ok) {
    logger.error(
      { codes, residences: residences.ok, blocks: blocks.ok },
      'Could not get apartments from property for listings'
    )
    return { ok: false, err: 'unknown' }
  }

  const blocksByRentalId = new Map<string, property.RentalBlock[]>()
  for (const block of blocks.data) {
    const list = blocksByRentalId.get(block.rentalId) ?? []
    list.push(block)
    blocksByRentalId.set(block.rentalId, list)
  }

  return {
    ok: true,
    data: residences.data.map((residence) =>
      toRentalObject(
        residence,
        blocksByRentalId.get(residence.rentalId) ?? [],
        availabilities.get(residence.rentalId)
      )
    ),
  }
}
