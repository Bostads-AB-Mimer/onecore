import { LeaseStatus } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as factory from '../../../../test/factories'
import {
  hasLeaseEnded,
  hasMovedToNewerLease,
} from '../helpers/customer-score-card'

// Lease dates from leasing are Swedish midnight in UTC, e.g. 2026-11-29T23:00Z
// is 30 November in Sweden.
const now = new Date('2026-11-24T10:00:00Z')

const paginated = (
  content: ReturnType<typeof factory.leaseSearchResult.build>[]
) => ({
  content,
  _meta: {
    totalRecords: content.length,
    page: 1,
    limit: 500,
    count: content.length,
  },
  _links: [],
})

beforeEach(jest.restoreAllMocks)

describe('hasLeaseEnded', () => {
  it('returns false on the last day of the lease', () => {
    // Arrange
    // 24 November in Sweden, still 23 November in UTC
    const lease = factory.leaseSearchResult.build({
      endDate: new Date('2026-11-23T23:00:00Z'),
    })

    // Act
    const ended = hasLeaseEnded(lease, now)

    // Assert
    expect(ended).toBe(false)
  })

  it('returns true the day after the last day', () => {
    // Arrange
    const lease = factory.leaseSearchResult.build({
      endDate: new Date('2026-11-22T23:00:00Z'),
    })

    // Act
    const ended = hasLeaseEnded(lease, now)

    // Assert
    expect(ended).toBe(true)
  })

  it('returns false for a lease without an end date', () => {
    // Arrange
    const lease = factory.leaseSearchResult.build({ endDate: null })

    // Act
    const ended = hasLeaseEnded(lease, now)

    // Assert
    expect(ended).toBe(false)
  })

  it('handles dates that arrive as ISO strings in JSON', () => {
    // Arrange
    const lease = factory.leaseSearchResult.build({
      // JSON from leasing carries the date as an ISO string.
      endDate: '2026-11-22T23:00:00.000Z' as unknown as Date,
    })

    // Act
    const ended = hasLeaseEnded(lease, now)

    // Assert
    expect(ended).toBe(true)
  })
})

describe('hasMovedToNewerLease', () => {
  const oldLease = factory.leaseSearchResult.build({
    leaseId: '705-001-01-0101/1',
    status: LeaseStatus.AboutToEnd,
    startDate: new Date('2019-12-31T23:00:00Z'),
    endDate: new Date('2026-11-29T23:00:00Z'),
  })

  it('returns true when the tenant has a newer lease that has started', async () => {
    // Arrange
    jest.spyOn(leasingAdapter, 'searchLeases').mockResolvedValue(
      paginated([
        oldLease,
        factory.leaseSearchResult.build({
          startDate: new Date('2026-10-31T23:00:00Z'),
        }),
      ])
    )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(true)
  })

  it('returns false for a current lease without looking anything up', async () => {
    // Arrange
    const searchSpy = jest.spyOn(leasingAdapter, 'searchLeases')
    const currentLease = factory.leaseSearchResult.build({
      status: LeaseStatus.Current,
    })

    // Act
    const moved = await hasMovedToNewerLease(currentLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
    expect(searchSpy).not.toHaveBeenCalled()
  })

  it('returns false when the newer lease starts tomorrow in Sweden', async () => {
    // Arrange
    // 25 November in Sweden, already 24 November in UTC
    jest.spyOn(leasingAdapter, 'searchLeases').mockResolvedValue(
      paginated([
        factory.leaseSearchResult.build({
          startDate: new Date('2026-11-24T23:00:00Z'),
        }),
      ])
    )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })

  it('returns false when the newer lease has ended too', async () => {
    // Arrange
    jest.spyOn(leasingAdapter, 'searchLeases').mockResolvedValue(
      paginated([
        factory.leaseSearchResult.build({
          status: LeaseStatus.AboutToEnd,
          startDate: new Date('2026-05-31T22:00:00Z'),
          endDate: new Date('2026-10-30T23:00:00Z'),
        }),
      ])
    )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })

  it('returns false when the other lease started the same day', async () => {
    // Arrange
    jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockResolvedValue(
        paginated([
          factory.leaseSearchResult.build({ startDate: oldLease.startDate }),
        ])
      )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })

  it('returns false when the other lease has no start date', async () => {
    // Arrange
    jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockResolvedValue(
        paginated([factory.leaseSearchResult.build({ startDate: null })])
      )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })

  it('returns false when the tenant only sublets the newer lease', async () => {
    // Arrange
    jest.spyOn(leasingAdapter, 'searchLeases').mockResolvedValue(
      paginated([
        factory.leaseSearchResult.build({
          startDate: new Date('2026-10-31T23:00:00Z'),
          contacts: [
            {
              contactCode: 'P200001',
              name: 'Förstahand Person',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
            {
              contactCode: 'P158770',
              name: 'Test Testsson',
              email: null,
              phone: null,
              contactType: 'subletTenant',
            },
          ],
        }),
      ])
    )

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })

  it('returns false when the lookup fails', async () => {
    // Arrange
    jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockRejectedValue(new Error('leasing unavailable'))

    // Act
    const moved = await hasMovedToNewerLease(oldLease, 'P158770', now)

    // Assert
    expect(moved).toBe(false)
  })
})
