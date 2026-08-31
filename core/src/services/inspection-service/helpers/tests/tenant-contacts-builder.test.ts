import { Lease } from '@onecore/types'

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import { buildTenantContactsResponse } from '../tenant-contacts-builder'

jest.mock('../../../../adapters/leasing-adapter')

const inspection = {
  id: 'insp-1',
  address: 'Testgatan 1',
  apartmentCode: 'A101',
  residenceId: 'res-1',
  leaseId: 'lease-tenant',
}

const makeLease = (overrides: Partial<Lease>): Lease =>
  ({
    leaseId: 'lease-x',
    leaseNumber: '001',
    leaseStartDate: new Date('2023-01-01'),
    leaseEndDate: undefined,
    status: 'Active' as any,
    type: 'Bostadskontrakt',
    rentalPropertyId: 'res-1',
    tenantContactIds: [],
    tenants: [],
    rentalProperty: undefined,
    rentInfo: undefined,
    address: undefined,
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: undefined,
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: undefined,
    lastDebitDate: undefined,
    approvalDate: undefined,
    ...overrides,
  }) as Lease

const tenantWithEmail = (overrides: any = {}) => ({
  contactCode: 'c-1',
  contactKey: 'k-1',
  firstName: 'A',
  lastName: 'B',
  fullName: 'A B',
  nationalRegistrationNumber: '0',
  birthDate: new Date('1990-01-01'),
  address: undefined,
  phoneNumbers: undefined,
  emailAddress: 'a@b.com',
  isTenant: true,
  ...overrides,
})

describe('buildTenantContactsResponse', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns both tenant and new_tenant when both contracts are present', async () => {
    const tenant = makeLease({
      leaseId: 'lease-tenant',
      leaseStartDate: new Date('2023-01-01'),
      tenants: [tenantWithEmail({ contactCode: 'tenant-1' })],
    })
    const newTenant = makeLease({
      leaseId: 'lease-new',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [tenantWithEmail({ contactCode: 'new-1' })],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      tenant,
      newTenant,
    ])

    const response = await buildTenantContactsResponse(inspection)

    expect(response.tenant?.contractId).toBe('lease-tenant')
    expect(response.new_tenant?.contractId).toBe('lease-new')
    expect(response.tenant?.contacts).toHaveLength(1)
    expect(response.new_tenant?.contacts).toHaveLength(1)
  })

  it('returns only tenant when no newer contract exists', async () => {
    const tenant = makeLease({
      leaseId: 'lease-tenant',
      tenants: [tenantWithEmail()],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      tenant,
    ])

    const response = await buildTenantContactsResponse(inspection)

    expect(response.tenant?.contractId).toBe('lease-tenant')
    expect(response.new_tenant).toBeUndefined()
  })

  it('returns no sections when no matching contracts exist for the residence', async () => {
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([])

    const response = await buildTenantContactsResponse(inspection)

    expect(response.tenant).toBeUndefined()
    expect(response.new_tenant).toBeUndefined()
    expect(response.inspection).toEqual({
      id: 'insp-1',
      address: 'Testgatan 1',
      apartmentCode: 'A101',
    })
  })

  it('filters out tenant contacts without email addresses', async () => {
    const tenant = makeLease({
      leaseId: 'lease-tenant',
      tenants: [
        tenantWithEmail({ contactCode: 'with-email' }),
        tenantWithEmail({ contactCode: 'no-email', emailAddress: undefined }),
      ],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      tenant,
    ])

    const response = await buildTenantContactsResponse(inspection)

    expect(response.tenant?.contacts).toHaveLength(1)
    expect(response.tenant?.contacts[0].contactCode).toBe('with-email')
  })

  it('passes the residence-include flags to the leasing adapter', async () => {
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([])

    await buildTenantContactsResponse(inspection)

    expect(leasingAdapter.getLeasesForPropertyId).toHaveBeenCalledWith(
      'res-1',
      {
        includeContacts: true,
        includeUpcomingLeases: true,
        includeTerminatedLeases: true,
      }
    )
  })
})
