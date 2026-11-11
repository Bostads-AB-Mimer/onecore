import { LeaseStatus, LeaseType } from '@onecore/types'

import * as endedLeaseAdapter from '../../../adapters/xpand/ended-lease-adapter'

const mockCalls: Array<{ method: string; args: unknown[] }> = []
let mockRows: unknown[] = []

jest.mock('knex', () => () => {
  const builder: any = new Proxy(
    {},
    {
      get: (_t, method: string) => {
        if (method === 'then') {
          return (resolve: (rows: unknown[]) => unknown) => resolve(mockRows)
        }
        return (...args: unknown[]) => {
          mockCalls.push({ method, args })
          args.forEach((a) => {
            if (typeof a === 'function') a.call(builder, builder)
          })
          return builder
        }
      },
    }
  )
  return builder
})

// Column aliases the adapter must select: leaseId, leaseType, objectTypeCode,
// startDate, lastDebitDate, address, postalCode, city, rentalObjectCode,
// property, districtName, contactCode, name, protectedIdentity (cmctc.lagsokt).
const baseRow = {
  leaseId: '123-456-789/01   ',
  leaseType: 'Bostadskontrakt   ',
  objectTypeCode: 'balgh  ',
  startDate: new Date('2015-01-01'),
  lastDebitDate: new Date('2020-06-30'),
  address: 'Testgatan 1  ',
  postalCode: '12345 ',
  city: 'Teststad ',
  rentalObjectCode: '123-456-789  ',
  property: 'Testfastigheten 1  ',
  districtName: 'Testdistrikt ',
  contactCode: 'P000001  ',
  name: 'Test Tenant  ',
  protectedIdentity: null,
}

const unwrap = (r: any): any[] => (r && 'ok' in r ? r.data : r)
const run = async () =>
  unwrap(await (endedLeaseAdapter as any).getAllEndedLeasesForSearch())

beforeEach(() => {
  mockCalls.length = 0
  mockRows = [baseRow]
})

describe('getAllEndedLeasesForSearch', () => {
  it('maps a row to a LeaseSearchResult', async () => {
    const [lease] = await run()

    expect(lease).toMatchObject({
      leaseId: '123-456-789/01',
      status: LeaseStatus.Ended,
      objectTypeCode: 'Bostad',
      leaseType: LeaseType.HousingContract,
      address: 'Testgatan 1',
      rentalObjectCode: '123-456-789',
      property: 'Testfastigheten 1',
      districtName: 'Testdistrikt',
      startDate: new Date('2015-01-01'),
      endDate: new Date('2020-06-30'),
      lastDebitDate: new Date('2020-06-30'),
    })
    expect(lease.externalUrl).toBeUndefined()
    expect(lease.contacts).toEqual([
      {
        name: 'Test Tenant',
        contactCode: 'P000001',
        email: null,
        phone: null,
        contactType: 'tenant',
      },
    ])
  })

  it('labels a parking lease "Parkering"', async () => {
    mockRows = [
      { ...baseRow, objectTypeCode: 'babps', leaseType: 'Bilplatskontrakt' },
    ]
    const [lease] = await run()
    expect(lease.objectTypeCode).toBe('Parkering')
    expect(lease.leaseType).toBe(LeaseType.ParkingSpaceContract)
  })

  it('folds two holders of one lease into one result', async () => {
    mockRows = [
      baseRow,
      { ...baseRow, contactCode: 'P000002 ', name: 'Second Tenant ' },
    ]
    const leases = await run()

    expect(leases).toHaveLength(1)
    expect(leases[0].contacts.map((c: any) => c.contactCode)).toEqual([
      'P000001',
      'P000002',
    ])
  })

  it('returns one result per lease', async () => {
    mockRows = [baseRow, { ...baseRow, leaseId: '123-456-789/02 ' }]
    const leases = await run()
    expect(leases.map((l) => l.leaseId)).toEqual([
      '123-456-789/01',
      '123-456-789/02',
    ])
  })

  it('blanks the name of a protected holder and keeps the contact code', async () => {
    mockRows = [{ ...baseRow, protectedIdentity: 1 }]
    const [lease] = await run()

    expect(lease.contacts[0].name).toBe('')
    expect(lease.contacts[0].contactCode).toBe('P000001')
  })

  it('queries ended leases with the object and district joins', async () => {
    await run()
    const text = JSON.stringify(mockCalls.map((c) => c.args))
    expect(text).toContain('hyobj.sistadeb')
    expect(text).toContain('babuf')
    expect(text).toContain('bafen')
  })
})
