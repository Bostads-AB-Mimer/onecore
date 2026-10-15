import assert from 'node:assert'
import { ListingStatus } from '@onecore/types'

import * as listingAdapter from '../../../adapters/listing-adapter'
import * as factory from '../../factories'
import { withContext } from '../../testUtils'

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000)

const summariesFor = (
  rentalObjects: Array<{
    rentalObjectCode: string
    listingHistorySince: Date | null
  }>,
  db: Parameters<
    typeof listingAdapter.getListingSummariesByRentalObjectCodes
  >[1]
) =>
  listingAdapter.getListingSummariesByRentalObjectCodes(
    { rentalObjects, listingCategory: 'APARTMENT' },
    db
  )

const closedRound = (rentalObjectCode: string, publishedFrom: Date) =>
  factory.listing.build({
    rentalObjectCode,
    listingCategory: 'APARTMENT',
    status: ListingStatus.Closed,
    publishedFrom,
    publishedTo: daysAgo(1),
  })

describe(listingAdapter.getListingSummariesByRentalObjectCodes, () => {
  it('returns an empty summary for a code with no listings', () =>
    withContext(async (ctx) => {
      const result = await summariesFor(
        [{ rentalObjectCode: 'no-history', listingHistorySince: null }],
        ctx.db
      )

      assert(result.ok)
      expect(result.data).toEqual([
        {
          rentalObjectCode: 'no-history',
          currentListing: null,
          closedListingsSinceLastLease: 0,
        },
      ])
    }))

  it('reports the open listing and counts closed rounds after the last lease', () =>
    withContext(async (ctx) => {
      // Two failed rounds for the previous tenancy, one for the current one.
      for (const publishedFrom of [daysAgo(40), daysAgo(30), daysAgo(10)]) {
        const created = await listingAdapter.createListing(
          closedRound('apt-1', publishedFrom),
          ctx.db
        )
        assert(created.ok)
      }
      const draft = await listingAdapter.createListing(
        factory.listing.build({
          listingCategory: 'APARTMENT',
          rentalObjectCode: 'apt-1',
          status: ListingStatus.Draft,
          publishedFrom: undefined,
          publishedTo: undefined,
          reviewedAt: new Date('2026-10-01T08:00:00Z'),
          reviewedBy: 'albin',
        }),
        ctx.db
      )
      assert(draft.ok)

      // Same code, other category: must not leak in.
      const parking = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: 'apt-1',
          listingCategory: 'PARKING_SPACE',
          status: ListingStatus.Closed,
        }),
        ctx.db
      )
      assert(parking.ok)

      const result = await summariesFor(
        [
          { rentalObjectCode: 'apt-1', listingHistorySince: daysAgo(20) },
          { rentalObjectCode: 'apt-2', listingHistorySince: null },
        ],
        ctx.db
      )

      assert(result.ok)
      expect(result.data).toHaveLength(2)
      const [apt1, apt2] = result.data
      expect(apt1.rentalObjectCode).toBe('apt-1')
      expect(apt1.currentListing).toMatchObject({
        id: draft.data.id,
        status: ListingStatus.Draft,
        publishedFrom: undefined,
        reviewedBy: 'albin',
      })
      expect(apt1.currentListing?.reviewedAt?.toISOString()).toBe(
        '2026-10-01T08:00:00.000Z'
      )
      expect(apt1.closedListingsSinceLastLease).toBe(1)
      expect(apt2).toEqual({
        rentalObjectCode: 'apt-2',
        currentListing: null,
        closedListingsSinceLastLease: 0,
      })
    }))

  it('counts every closed listing when no lease is known', () =>
    withContext(async (ctx) => {
      for (const publishedFrom of [daysAgo(30), daysAgo(20)]) {
        const created = await listingAdapter.createListing(
          closedRound('apt-3', publishedFrom),
          ctx.db
        )
        assert(created.ok)
      }

      const result = await summariesFor(
        [{ rentalObjectCode: 'apt-3', listingHistorySince: null }],
        ctx.db
      )

      assert(result.ok)
      expect(result.data[0]).toMatchObject({
        currentListing: null,
        closedListingsSinceLastLease: 2,
      })
    }))
})
