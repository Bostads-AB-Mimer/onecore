import { Lease } from '@onecore/types'

import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as emailSender from '../email-sender'
import * as pdfGenerator from '../pdf-generator'
import { sendProtocolForInspection } from '../protocol-sender'
import type { DetailedInspection } from '../../schemas'

jest.mock('../../../../adapters/leasing-adapter')
jest.mock('../email-sender', () => {
  const actual = jest.requireActual('../email-sender')
  return {
    ...actual,
    sendProtocolToTenants: jest.fn(),
  }
})
jest.mock('../pdf-generator')

const inspection = {
  id: 'insp-1',
  residenceId: 'res-1',
  leaseId: 'lease-tenant',
  address: 'Testgatan 1',
  apartmentCode: 'A101',
} as unknown as DetailedInspection

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
    ...overrides,
  }) as Lease

const tenant = (overrides: any = {}) => ({
  contactCode: 'c-1',
  contactKey: 'k-1',
  firstName: 'A',
  lastName: 'B',
  fullName: 'A B',
  nationalRegistrationNumber: '0',
  birthDate: new Date('1990-01-01'),
  emailAddress: 'a@b.com',
  isTenant: true,
  ...overrides,
})

describe('sendProtocolForInspection', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns 400 when no contract matches the recipient', async () => {
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([])

    const result = await sendProtocolForInspection(inspection, 'tenant')

    expect(result.status).toBe(400)
    expect(result.body.success).toBe(false)
    expect(result.body.error).toMatch(/No contract found/)
    expect(result.body.recipient).toBe('tenant')
    expect(result.body.sentTo.contractId).toBe('')
  })

  it('returns 400 when contract has no tenants with email', async () => {
    const lease = makeLease({
      leaseId: 'lease-tenant',
      tenants: [tenant({ emailAddress: undefined })],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      lease,
    ])

    const result = await sendProtocolForInspection(inspection, 'tenant')

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('No email addresses found for tenant')
    expect(result.body.sentTo.contractId).toBe('lease-tenant')
  })

  it('returns 500 and logs when PDF generation throws', async () => {
    const lease = makeLease({
      leaseId: 'lease-tenant',
      tenants: [tenant()],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      lease,
    ])
    ;(
      pdfGenerator.generateInspectionProtocolPdf as jest.Mock
    ).mockRejectedValue(new Error('boom'))

    const result = await sendProtocolForInspection(inspection, 'tenant')

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Failed to generate PDF protocol')
    expect(result.body.sentTo.contractId).toBe('lease-tenant')
  })

  it('returns 200 on successful send', async () => {
    const lease = makeLease({
      leaseId: 'lease-tenant',
      tenants: [tenant()],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      lease,
    ])
    ;(
      pdfGenerator.generateInspectionProtocolPdf as jest.Mock
    ).mockResolvedValue(Buffer.from('pdf'))
    ;(emailSender.sendProtocolToTenants as jest.Mock).mockResolvedValue({
      success: true,
      emails: ['a@b.com'],
      contactNames: ['A B'],
      contractId: 'lease-tenant',
    })

    const result = await sendProtocolForInspection(inspection, 'tenant')

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.sentTo.emails).toEqual(['a@b.com'])
    expect(result.body.sentTo.contractId).toBe('lease-tenant')
  })

  it('includes costs for outgoing tenant', async () => {
    const lease = makeLease({
      leaseId: 'lease-tenant',
      tenants: [tenant()],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      lease,
    ])
    ;(
      pdfGenerator.generateInspectionProtocolPdf as jest.Mock
    ).mockResolvedValue(Buffer.from('pdf'))
    ;(emailSender.sendProtocolToTenants as jest.Mock).mockResolvedValue({
      success: true,
      emails: [],
      contactNames: [],
      contractId: 'lease-tenant',
    })

    await sendProtocolForInspection(inspection, 'tenant')

    expect(pdfGenerator.generateInspectionProtocolPdf).toHaveBeenCalledWith(
      inspection,
      { includeCosts: true }
    )
  })

  it('omits costs for incoming new tenant', async () => {
    const lease = makeLease({
      leaseId: 'lease-new',
      leaseStartDate: new Date('2024-01-01'),
      tenants: [tenant()],
    })
    const tenantLease = makeLease({
      leaseId: 'lease-tenant',
      leaseStartDate: new Date('2023-01-01'),
      tenants: [tenant()],
    })
    ;(leasingAdapter.getLeasesForPropertyId as jest.Mock).mockResolvedValue([
      tenantLease,
      lease,
    ])
    ;(
      pdfGenerator.generateInspectionProtocolPdf as jest.Mock
    ).mockResolvedValue(Buffer.from('pdf'))
    ;(emailSender.sendProtocolToTenants as jest.Mock).mockResolvedValue({
      success: true,
      emails: [],
      contactNames: [],
      contractId: 'lease-new',
    })

    await sendProtocolForInspection(inspection, 'new-tenant')

    expect(pdfGenerator.generateInspectionProtocolPdf).toHaveBeenCalledWith(
      inspection,
      { includeCosts: false }
    )
  })
})
