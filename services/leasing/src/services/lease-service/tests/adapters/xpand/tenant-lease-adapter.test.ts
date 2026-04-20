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
  whereNotNull: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderByRaw: jest.fn().mockReturnThis(),
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
          deceased: null,
          emigrated: null,
          noAdvertising: null,
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
          street2: undefined,
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
        housingWaitingList: undefined,
        storageWaitingList: undefined,
        protectedIdentity: false,
        deceased: false,
        emigrated: false,
        noAdvertising: false,
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

const buildRow = (overrides = {}) => ({
  contactCode: 'P123456',
  contactKey: '_ADBAEC',
  firstName: 'Test',
  lastName: 'Testman',
  fullName: 'Test Testman',
  nationalRegistrationNumber: '121212121212',
  birthDate: '1212-12-12',
  street: 'Gatvägen 12',
  street2: undefined,
  postalCode: '12345',
  city: 'Test City',
  emailAddress: 'noreply@mimer.nu',
  protectedIdentity: null,
  deceased: null,
  emigrated: null,
  noAdvertising: null,
  specialAttention: null,
  ...overrides,
})

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
      isMainNumber: number
    }[] = []
    const leaseIds: string[] = []

    const contact: Contact = tenantLeaseAdapter.transformFromDbContact(
      rows,
      phoneNumbers,
      leaseIds,
      false
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
      isMainNumber: number
    }[] = []
    const leaseIds: string[] = []

    const contact: Contact = tenantLeaseAdapter.transformFromDbContact(
      rows,
      phoneNumbers,
      leaseIds,
      false
    )

    expect(contact.specialAttention).toBe(true)
  })

  it('deceased is false when db value is null', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ deceased: null })],
      [],
      []
    )
    expect(contact.deceased).toBe(false)
  })

  it('deceased is true when db value is non-null', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ deceased: '2024-01-01' })],
      [],
      []
    )
    expect(contact.deceased).toBe(true)
  })

  it('emigrated is false when db value is null', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ emigrated: null })],
      [],
      []
    )
    expect(contact.emigrated).toBe(false)
  })

  it('emigrated is true when db value is non-null', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ emigrated: '2024-01-01' })],
      [],
      []
    )
    expect(contact.emigrated).toBe(true)
  })

  it('noAdvertising is false when db value is null', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ noAdvertising: null })],
      [],
      []
    )
    expect(contact.noAdvertising).toBe(false)
  })

  it('noAdvertising is false when db value is 0', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ noAdvertising: 0 })],
      [],
      []
    )
    expect(contact.noAdvertising).toBe(false)
  })

  it('noAdvertising is true when db value is non-zero', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ noAdvertising: 1 })],
      [],
      []
    )
    expect(contact.noAdvertising).toBe(true)
  })

  it('maps street2 from db row', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ street2: 'c/o Någon' })],
      [],
      []
    )
    expect(contact.address?.street2).toBe('c/o Någon')
  })

  it('street2 is undefined when db value is undefined', () => {
    const contact = tenantLeaseAdapter.transformFromDbContact(
      [buildRow({ street2: undefined })],
      [],
      []
    )
    expect(contact.address?.street2).toBeUndefined()
  })
})
