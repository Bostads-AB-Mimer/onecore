import { WaitingListType, Contact, Lease } from '@onecore/types'
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
        specialAttention: false,
        emailAddress: 'redacted',
        isTenant: false,
        parkingSpaceWaitingList: {
          queuePoints: 366,
          queueTime: expect.any(Date),
          type: WaitingListType.ParkingSpace,
        },
        housingWaitinglist: undefined,
        storageWaitingList: undefined,
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
    const activeLease = lease
      .params({
        leaseStartDate: new Date(),
        lastDebitDate: futureDate,
        terminationDate: undefined,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeLease)).toBe(true)
  })
  it('should return true if lastDebitDate is today', () => {
    const activeLease = lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: new Date(),
        terminationDate: undefined,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeLease)).toBe(true)
  })
  it('should return false if lease if lastDebitDate is in the past', () => {
    const activeLease = lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: pastDate,
        terminationDate: undefined,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(activeLease)).toBe(false)
  })
  it('should return false if lease is terminated', () => {
    const terminatedLease = lease
      .params({
        leaseStartDate: pastDate,
        terminationDate: pastDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(terminatedLease)).toBe(false)
  })
  it('should return false if lease is upcoming', () => {
    const upcomingLease = lease
      .params({
        leaseStartDate: futureDate,
        terminationDate: undefined,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseActive(upcomingLease)).toBe(false)
  })
})

describe('isLeaseUpcoming', () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1)
  it('should return true if lease is upcoming', () => {
    const upcomingLease = lease
      .params({
        leaseStartDate: futureDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseUpcoming(upcomingLease)).toBe(true)
  })
  it('should return false if lease is active', () => {
    const activeLease = lease
      .params({
        leaseStartDate: pastDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseUpcoming(activeLease)).toBe(false)
  })
})

describe('isLeaseTerminated', () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1)
  it('should return true if lease is terminated', () => {
    const terminatedLease = lease
      .params({
        leaseStartDate: pastDate,
        terminationDate: pastDate,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseTerminated(terminatedLease)).toBe(true)
  })
  it('should return false if lease is active', () => {
    const activeLease = lease
      .params({
        leaseStartDate: pastDate,
        terminationDate: undefined,
      })
      .build()

    expect(tenantLeaseAdapter.isLeaseTerminated(activeLease)).toBe(false)
  })
})

describe('filterLeasesByOptions', () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1)

  const activeLeases = [
    lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: undefined,
        terminationDate: undefined,
      })
      .build(),
    lease
      .params({
        leaseStartDate: new Date(),
        lastDebitDate: undefined,
        terminationDate: undefined,
      })
      .build(),
    lease
      .params({
        leaseStartDate: pastDate,
        lastDebitDate: futureDate,
        terminationDate: undefined,
      })
      .build(),
  ]
  const upcomingLeases = [
    lease
      .params({
        leaseStartDate: futureDate,
        lastDebitDate: undefined,
        terminationDate: undefined,
      })
      .build(),
    lease
      .params({
        leaseStartDate: futureDate,
        lastDebitDate: futureDate,
        terminationDate: undefined,
      })
      .build(),
  ]

  const terminatedLeases = [
    lease
      .params({
        leaseStartDate: pastDate,
        terminationDate: pastDate,
      })
      .build(),
  ]

  const leases = activeLeases.concat(upcomingLeases).concat(terminatedLeases)

  it('should return only active leases', () => {
    const filteredLeases = tenantLeaseAdapter.filterLeasesByOptions(leases, {
      includeUpcomingLeases: false,
      includeTerminatedLeases: false,
      includeContacts: false,
    })

    expect(filteredLeases).toStrictEqual(activeLeases)
  })
  it('should return only active and upcoming leases', () => {
    const filteredLeases = tenantLeaseAdapter.filterLeasesByOptions(leases, {
      includeUpcomingLeases: true,
      includeTerminatedLeases: false,
      includeContacts: false,
    })

    expect(filteredLeases).toStrictEqual(activeLeases.concat(upcomingLeases))
  })
  it('should return only active and terminated leases', () => {
    const filteredLeases = tenantLeaseAdapter.filterLeasesByOptions(leases, {
      includeUpcomingLeases: false,
      includeTerminatedLeases: true,
      includeContacts: false,
    })

    expect(filteredLeases).toStrictEqual(activeLeases.concat(terminatedLeases))
  })
  it('should return all leases', () => {
    const filteredLeases = tenantLeaseAdapter.filterLeasesByOptions(leases, {
      includeUpcomingLeases: true,
      includeTerminatedLeases: true,
      includeContacts: false,
    })

    expect(filteredLeases).toStrictEqual(leases)
  })
})

// describe('isLeaseActive', () => {
//   const futureDate = new Date()
//   futureDate.setDate(futureDate.getDate() + 1)
//   const pastDate = new Date()
//   pastDate.setDate(pastDate.getDate() - 1)

//   it('should return true if lease is active', () => {
//     const activeContract = lease
//       .params({
//         leaseStartDate: pastDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActive(activeContract)).toBe(true)
//   })

//   it('should return true if start date is today', () => {
//     const activeContract = lease
//       .params({
//         leaseStartDate: new Date(),
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActive(activeContract)).toBe(true)
//   })

//   it('should return false if lease start date is in the future', () => {
//     const upcomingContract = lease
//       .params({
//         leaseStartDate: futureDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActive(upcomingContract)).toBe(false)
//   })
// })

// describe('isLeaseActiveOrUpcoming', () => {
//   const futureDate = new Date()
//   futureDate.setDate(futureDate.getDate() + 1)
//   const pastDate = new Date()
//   pastDate.setDate(pastDate.getDate() - 1)

//   it('should return true if lease is active', () => {
//     const activeContract = lease
//       .params({
//         leaseStartDate: pastDate,
//         lastDebitDate: futureDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActiveOrUpcoming(activeContract)).toBe(
//       true
//     )
//   })

//   it('should return true if lease start date is in the future', () => {
//     const upcomingContract = lease
//       .params({
//         leaseStartDate: futureDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActiveOrUpcoming(upcomingContract)).toBe(
//       true
//     )
//   })

//   it('should return true if lease has last debit date today', () => {
//     const activeContract = lease
//       .params({
//         leaseStartDate: pastDate,
//         lastDebitDate: new Date(),
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActiveOrUpcoming(activeContract)).toBe(
//       true
//     )
//   })

//   it('should return false if lease has a termination date in the past', () => {
//     const terminatedContract = lease
//       .params({
//         terminationDate: pastDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActiveOrUpcoming(terminatedContract)).toBe(
//       false
//     )
//   })

//   it('should return true if termination date is in the future', () => {
//     const activeContract = lease
//       .params({
//         leaseStartDate: pastDate,
//         terminationDate: futureDate,
//       })
//       .build()

//     expect(tenantLeaseAdapter.isLeaseActiveOrUpcoming(activeContract)).toBe(
//       true
//     )
//   })
// })

describe('transformFromDbContact', () => {
  it('should handle protected identity correctly', () => {
    const rows = [
      {
        contactCode: 'P123456',
        contactKey: '_ADBAEC',
        firstName: 'Test',
        lastName: 'Testman',
        fullName: 'Test Testman',
        nationalRegistrationNumber: '121212121212',
        birthDate: '1212-12-12',
        street: 'Gatvägen 12',
        postalCode: '12345',
        city: 'Test City',
        emailAddress: 'noreply@mimer.nu',
        protectedIdentity: true,
      },
    ]
    const phoneNumbers: {
      phoneNumber: string
      type: string
      isMainNumber: boolean
    }[] = []
    const leases: Lease[] = []

    const contact: Contact = tenantLeaseAdapter.transformFromDbContact(
      rows,
      phoneNumbers,
      leases
    )

    expect(contact.firstName).toBeUndefined()
    expect(contact.lastName).toBeUndefined()
    expect(contact.fullName).toBeUndefined()
    expect(contact.nationalRegistrationNumber).toBeUndefined()
    expect(contact.birthDate).toBeUndefined()
  })

  it('should handle special attention correctly', () => {
    const rows = [
      {
        contactCode: 'P123456',
        contactKey: '_ADBAEC',
        firstName: 'Test',
        lastName: 'Testman',
        fullName: 'Test Testman',
        nationalRegistrationNumber: '121212121212',
        birthDate: '1212-12-12',
        street: 'Gatvägen 12',
        postalCode: '12345',
        city: 'Test City',
        emailAddress: 'noreply@mimer.nu',
        protectedIdentity: false,
        specialAttention: '2025-01-01',
      },
    ]
    const phoneNumbers: {
      phoneNumber: string
      type: string
      isMainNumber: boolean
    }[] = []
    const leases: Lease[] = []

    const contact: Contact = tenantLeaseAdapter.transformFromDbContact(
      rows,
      phoneNumbers,
      leases
    )

    expect(contact.specialAttention).toBe(true)
  })
})
