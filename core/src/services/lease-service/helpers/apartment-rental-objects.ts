import { RentalObject, RentalObjectAvailabilityInfo } from '@onecore/types'
import { determineVacantFrom, logger } from '@onecore/utilities'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import { components } from '../../../adapters/property-base-adapter/generated/api-types'
import { AdapterResult } from '../../../adapters/types'

// Property takes at most 200 rental ids per request.
const PROPERTY_BATCH_SIZE = 200
// Blocks are fetched one apartment at a time; cap the requests in flight.
const BLOCK_CONCURRENCY = 10

type Block = {
  fromDate: string
  toDate: string | null
  blockReasonId: string | null
}
type RentalObjectSummary = components['schemas']['RentalObjectSummary']
type RentalObjectDetails = components['schemas']['RentalObjectDetails']

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = []
  for (const batch of chunk(items, limit)) {
    results.push(...(await Promise.all(batch.map(fn))))
  }
  return results
}

/**
 * The block that decides vacancy, picked as leasing does for parking spaces:
 * blocks without a reason are ignored (leasing inner joins hyspa), then one
 * without an end date if there is one, otherwise the one ending last.
 */
export const latestBlock = (blocks: Block[]): Block | undefined => {
  const withReason = blocks.filter((block) => block.blockReasonId)
  return (
    withReason.find((block) => !block.toDate) ??
    [...withReason].sort((a, b) => (a.toDate! < b.toDate! ? 1 : -1))[0]
  )
}

const getLatestBlocks = async (
  rentalIds: string[]
): Promise<AdapterResult<Map<string, Block>, 'unknown'>> => {
  const results = await mapWithConcurrency(
    rentalIds,
    BLOCK_CONCURRENCY,
    async (rentalId) => ({
      rentalId,
      result: await propertyBaseAdapter.getRentalBlocksByRentalId(rentalId),
    })
  )

  const blocks = new Map<string, Block>()
  for (const { rentalId, result } of results) {
    if (!result.ok) {
      if (result.err === 'not-found') continue
      return { ok: false, err: 'unknown' }
    }
    const block = latestBlock(result.data)
    if (block) blocks.set(rentalId, block)
  }
  return { ok: true, data: blocks }
}

const getLeaseAvailabilities = async (
  rentalIds: string[]
): Promise<Map<string, RentalObjectAvailabilityInfo>> => {
  const result = await leasingAdapter.getLeaseAvailabilities(rentalIds)
  // Without lease data the apartments are still listed, just without rent and
  // vacancy (as a single parking space is; the parking space list fails
  // instead). Listing pages can show the rest of the object meanwhile.
  // Codes the leases don't know are simply absent from the result.
  if (!result.ok) {
    logger.error(
      { rentalIds },
      'Could not get lease availabilities for apartments'
    )
    return new Map()
  }
  return new Map(result.data.map((info) => [info.rentalObjectCode, info]))
}

/**
 * Apartments by rental object code. The object comes from property, rent,
 * vacancy, rental tenure type and tags from the leases, and vacantFrom is
 * adjusted for blocks with the same rule as parking spaces. Codes that aren't
 * apartments are left out. A failed property lookup, objects or blocks, is an error: a
 * wrong vacantFrom is worse than none. A failed lease lookup is not, see
 * getLeaseAvailabilities.
 */
export const getApartments = async (
  rentalObjectCodes: string[]
): Promise<AdapterResult<RentalObject[], 'unknown'>> => {
  const codes = [...new Set(rentalObjectCodes)]
  if (codes.length === 0) return { ok: true, data: [] }

  const batches = await Promise.all(
    chunk(codes, PROPERTY_BATCH_SIZE).map((rentalIds) =>
      Promise.all([
        propertyBaseAdapter.searchRentalObjects({
          rentalIds,
          types: ['residence'],
          limit: rentalIds.length,
        }),
        propertyBaseAdapter.getRentalObjectDetails({ rentalIds }),
      ])
    )
  )

  const summaries: RentalObjectSummary[] = []
  const details = new Map<string, RentalObjectDetails>()
  for (const [search, detail] of batches) {
    if (!search.ok || !detail.ok) {
      logger.error(
        { codes },
        'Could not get apartments from property for listings'
      )
      return { ok: false, err: 'unknown' }
    }
    summaries.push(...search.data.content)
    for (const row of detail.data) details.set(row.rentalId, row)
  }

  // No filtering on rental type here: these are the objects of existing
  // listings. Which apartments are listed in OneCore at all (not student
  // apartments, whose leases are made by hand in Tenfast) is decided when
  // listings are published.
  const apartments = summaries
  const rentalIds = apartments.map((apartment) => apartment.rentalId)
  if (rentalIds.length === 0) return { ok: true, data: [] }

  const [blocks, availabilities] = await Promise.all([
    getLatestBlocks(rentalIds),
    getLeaseAvailabilities(rentalIds),
  ])
  if (!blocks.ok) {
    logger.error({ rentalIds }, 'Could not get blocks for apartments')
    return { ok: false, err: 'unknown' }
  }

  return {
    ok: true,
    data: apartments.map((summary): RentalObject => {
      const detail = details.get(summary.rentalId)
      const block = blocks.data.get(summary.rentalId)
      const availability = availabilities.get(summary.rentalId)
      return {
        rentalObjectCode: summary.rentalId,
        address: summary.address ?? '',
        propertyCode: summary.propertyCode ?? undefined,
        propertyCaption: summary.propertyName ?? undefined,
        residentialAreaCode: detail?.marketAreaCode ?? '',
        residentialAreaCaption: detail?.marketAreaName ?? '',
        objectTypeCode: summary.subtypeCode ?? '',
        objectTypeCaption: summary.subtypeName ?? '',
        boaArea: detail?.boaArea ?? undefined,
        braArea: detail?.area ?? undefined,
        floor: detail?.floor ?? undefined,
        roomCount: detail?.roomCount ?? undefined,
        blockStartDate: block ? new Date(block.fromDate) : undefined,
        blockEndDate: block?.toDate ? new Date(block.toDate) : undefined,
        availabilityInfo: availability && {
          ...availability,
          vacantFrom: determineVacantFrom(
            availability.vacantFrom,
            block?.fromDate,
            block?.toDate
          ),
        },
      }
    }),
  }
}
