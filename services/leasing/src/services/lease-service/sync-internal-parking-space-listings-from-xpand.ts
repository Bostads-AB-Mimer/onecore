import { ListingStatus } from '@onecore/types'
import { Knex } from 'knex'
import { z } from 'zod'

import * as xpandSoapAdapter from './adapters/xpand/xpand-soap-adapter'
import * as listingAdapter from './adapters/listing-adapter'
import * as leaseAdapter from './adapters/xpand/tenant-lease-adapter'
import { AdapterResult } from './adapters/types'
import { ListingWithoutRentalObject } from '../../common/types'

type CreateListingData = Omit<ListingWithoutRentalObject, 'id'>
type ServiceError = 'get-parking-spaces' | 'get-residential-area' | 'unknown'

type CreateListingErrors = Extract<
  Awaited<ReturnType<typeof listingAdapter.createListing>>,
  { ok: false }
>['err']

type ServiceSuccessData = {
  invalid: ParseInternalParkingSpacesToInsertableListingsResult['invalid']
  insertions: {
    inserted: Array<ListingWithoutRentalObject>
    failed: Array<{
      listing: CreateListingData
      err: CreateListingErrors
    }>
  }
}

const ValidInternalParkingSpace = z.object({
  RentalObjectCode: z.string(),
  Address1: z.string(),
  MonthRent: z.number(),
  PublishedFrom: z.coerce.date(),
  PublishedTo: z.coerce.date(),
  VacantFrom: z.coerce.date(),
  WaitingListType: z.literal('Bilplats (intern)'),
  DistrictCaption: z.string().nullish(),
  DistrictCode: z.string().nullish(),
  BlockCaption: z.string().nullish(),
  BlockCode: z.string().nullish(),
  ObjectTypeCaption: z.string().nullish(),
  ObjectTypeCode: z.string().nullish(),
  RentalObjectTypeCaption: z.string().nullish(),
  RentalObjectTypeCode: z.string().nullish(),
})

/*
 * This service gets all published parking spaces from Xpand SOAP API
 * Then it processes the data in the following way:
 * - Keep only parking spaces that have WaitingListType Bilplats (intern)
 * - Parse all internal parking spaces using the Zod schema
 *   ValidInternalParkingSpace. Return an object with two properties:
 *   'ok'      -> a list of parking spaces mapped to listings, ready to be inserted
 *   'invalid' -> a list of { rentalObjectCode: string, err } where err is an
 *   array of errors associated with this internal parking space.
 *
 *   We do this because there is at least one known issue, where internal
 *   parking spaces are missing "PublishedTo", which is non-compatible with our
 *   current database. So we basically return which one failed and why.
 *
 * - Then we iterate all the parsed parking spaces and patch them with
 *   residential area info (districtCode, districtCaption), as that
 *   info is missing from the Xpand Soap response.
 *
 * - Then we take all the 'valid' parking spaces and try to insert them.
 *   The ones who succeeded goes into an insertions.inserted array and the ones
 *   who failed goes into an insertions.failed array.
 */
export async function syncInternalParkingSpaces(
  db: Knex
): Promise<AdapterResult<ServiceSuccessData, ServiceError>> {
  const result = await xpandSoapAdapter.getPublishedInternalParkingSpaces()

  if (!result.ok) {
    return { ok: false, err: 'get-parking-spaces' }
  }

  const internalParkingSpaces = result.data.filter(
    (v: { WaitingListType: string }) =>
      v.WaitingListType === 'Bilplats (intern)'
  )

  const parseInternalParkingSpacesResult =
    parseInternalParkingSpacesToInsertableListings(internalParkingSpaces)

  const patchParkingSpacesWithResidentialAreaResult =
    await patchParkingSpacesWithResidentialArea(
      parseInternalParkingSpacesResult.ok
    )

  if (!patchParkingSpacesWithResidentialAreaResult.ok) {
    return { ok: false, err: 'get-residential-area' }
  }

  const insertions = await insertListings(
    db,
    patchParkingSpacesWithResidentialAreaResult.data
  )

  const aggregatedInsertions = aggregateInsertions(insertions)

  return {
    ok: true,
    data: {
      invalid: parseInternalParkingSpacesResult.invalid,
      insertions: aggregatedInsertions,
    },
  }
}

function insertListings(db: Knex, items: Array<CreateListingData>) {
  return Promise.all(
    items.map(async (listing) => ({
      listing,
      insertionResult: await listingAdapter.createListing(listing, db),
    }))
  )
}

function aggregateInsertions(
  insertions: Array<{
    listing: CreateListingData
    insertionResult: Awaited<ReturnType<typeof listingAdapter.createListing>>
  }>
) {
  return insertions.reduce<ServiceSuccessData['insertions']>(
    (acc, curr) => {
      if (!curr.insertionResult.ok) {
        return {
          ...acc,
          failed: acc.failed.concat({
            listing: curr.listing,
            err: curr.insertionResult.err,
          }),
        }
      } else {
        return {
          ...acc,
          inserted: acc.inserted.concat(curr.insertionResult.data),
        }
      }
    },
    {
      inserted: [],
      failed: [],
    }
  )
}

// TODO: Use from onecore-types once merged
type ParseInternalParkingSpacesToInsertableListingsResult = {
  ok: Array<CreateListingData>
  invalid: Array<{
    rentalObjectCode: string
    errors: Array<{ path: string; code: string }>
  }>
}

export function parseInternalParkingSpacesToInsertableListings(
  parkingspaces: Array<any>
): ParseInternalParkingSpacesToInsertableListingsResult {
  return parkingspaces.reduce<ParseInternalParkingSpacesToInsertableListingsResult>(
    (acc, curr) => {
      const parseResult = ValidInternalParkingSpace.safeParse(curr)
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => {
          return { path: String(e.path[0]), code: e.code }
        })

        return {
          ...acc,
          invalid: acc.invalid.concat({
            rentalObjectCode: curr.RentalObjectCode,
            errors,
          }),
        }
      }

      return {
        ...acc,
        ok: acc.ok.concat(toInternalParkingSpaceListingsData(parseResult.data)),
      }
    },
    { ok: [], invalid: [] }
  )
}

function patchParkingSpacesWithResidentialArea(
  items: Array<CreateListingData>
): Promise<AdapterResult<Array<CreateListingData>, 'get-residential-area'>> {
  return Promise.all(
    items.map(async (v) => {
      const result = await leaseAdapter.getResidentialAreaByRentalPropertyId(
        v.rentalObjectCode
      )

      if (!result.ok) {
        return Promise.reject(
          'Something went wrong, this operation should fail'
        )
      }

      return {
        ...v,
        districtCode: result.data?.code,
        districtCaption: result.data?.caption,
      }
    })
  )
    .then((items) => ({ ok: true, data: items }) as const)
    .catch(() => ({ ok: false, err: 'get-residential-area' }) as const)
}

export function toInternalParkingSpaceListingsData(
  item: z.infer<typeof ValidInternalParkingSpace>
): CreateListingData {
  return {
    rentalObjectCode: item.RentalObjectCode,
    publishedFrom: new Date(item.PublishedFrom),
    publishedTo: new Date(item.PublishedTo),
    status: ListingStatus.Active,
    rentalRule: 'SCORED',
    listingCategory: 'PARKING_SPACE',
  }
}
