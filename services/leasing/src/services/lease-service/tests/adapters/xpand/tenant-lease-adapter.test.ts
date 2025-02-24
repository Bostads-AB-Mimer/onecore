import { WaitingListType } from 'onecore-types'
import { sub } from 'date-fns'

import { lease } from '../../factories'
import * as tenantLeaseAdapter from '../../../adapters/xpand/tenant-lease-adapter'

jest.mock('knex', () => () => ({
  raw: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  then: jest
    .fn()
    .mockImplementationOnce((callback) =>
      callback([
        {
          contactCode: 'P123456',
          firstName: 'Test ',
          lastName: 'Testman  ',
          fullName: 'Test Testman   ',
          nationalRegistrationNumber: '121212121212',
          birthDate: '1212-12-12',
          street: 'Gatvägen 12    ',
          postalCode: '12345 ',
          city: null,
          emailAddress: 'noreply@mimer.nu  ',
          keycmobj: '12345',
          contactKey: '_ADBAEC',
          queueName: 'Bilplats (intern)',
          queueTime: sub(new Date(), { days: 366 }),
          protectedIdentity: null,
        },
      ])
    )
    .mockImplementationOnce((callback) => {
      callback([
        {
          phoneNumber: '070123456 ',
          type: 'mobil  ',
          isMainNumber: true,
        },
      ])
    })
    .mockImplementationOnce((callback) => {
      callback([])
    }),
}))

describe(tenantLeaseAdapter.getContactByContactCode, () => {
  it('returns a contact with trimmed string fields', async () => {
    const contact = await tenantLeaseAdapter.getContactByContactCode(
      'P123456',
      false
    )

    expect(contact).toStrictEqual({
      ok: true,
      data: {
        contactCode: 'P123456',
        contactKey: '_ADBAEC',
        firstName: 'Test',
        lastName: 'Testman',
        fullName: 'Test Testman',
        leaseIds: [],
        nationalRegistrationNumber: '121212121212',
        birthDate: '1212-12-12',
        address: {
          street: 'Gatvägen 12',
          number: '',
          postalCode: '12345',
          city: null,
        },
        phoneNumbers: [
          {
            phoneNumber: '070123456',
            type: 'mobil',
            isMainNumber: true,
          },
        ],
        emailAddress: 'redacted',
        isTenant: false,
        parkingSpaceWaitingList: {
          queuePoints: 366,
          queueTime: expect.any(Date),
          type: WaitingListType.ParkingSpace,
        },
      },
    })
  })
})

describe('isLeaseActive', () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1)

  it('should return true if lease is active', () => {
    const activeContract = lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: futureDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeContract)).toBe(true)
  })

  it('should return false if lease start date is in the future', () => {
    const upcomingContract = lease
      .params({
        leaseStartDate: futureDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(upcomingContract)).toBe(false)
  })

  it('should return true if lease has last debit date today', () => {
    const activeContract = lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: new Date(),
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeContract)).toBe(true)
  })

  it('should return false if lease has a termination date in the past', () => {
    const terminatedContract = lease
      .params({
        terminationDate: pastDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(terminatedContract)).toBe(false)
  })

  it('should return true if termination date is in the future', () => {
    const activeContract = lease
      .params({
        leaseStartDate: pastDate,
        terminationDate: futureDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeContract)).toBe(true)
  })
})
