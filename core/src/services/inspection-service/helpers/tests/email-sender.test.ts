import { Lease, LeaseStatus, Contact } from '@onecore/types'
import { identifyTenantContracts, sendProtocolToTenants } from '../email-sender'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import type { DetailedInspection } from '../../schemas'

// Mock the communication adapter
jest.mock('../../../../adapters/communication-adapter')

describe('identifyTenantContracts', () => {
  it('should identify tenant by inspectionLeaseId and new tenant as the latest lease', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-new',
        leaseNumber: '001',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
        tenantContactIds: ['contact-1'],
        tenants: [
          {
            contactCode: 'contact-1',
            contactKey: 'key-1',
            firstName: 'New',
            lastName: 'Tenant',
            fullName: 'New Tenant',
            nationalRegistrationNumber: '1234567890',
            birthDate: new Date('1990-01-01'),
            address: undefined,
            phoneNumbers: undefined,
            emailAddress: 'new@example.com',
            isTenant: true,
          },
        ],
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
      },
      {
        leaseId: 'lease-previous',
        leaseNumber: '002',
        leaseStartDate: new Date('2023-01-01'),
        leaseEndDate: new Date('2023-12-31'),
        status: 'Terminated' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
        tenantContactIds: ['contact-2'],
        tenants: [
          {
            contactCode: 'contact-2',
            contactKey: 'key-2',
            firstName: 'Previous',
            lastName: 'Tenant',
            fullName: 'Previous Tenant',
            nationalRegistrationNumber: '0987654321',
            birthDate: new Date('1985-01-01'),
            address: undefined,
            phoneNumbers: undefined,
            emailAddress: 'previous@example.com',
            isTenant: true,
          },
        ],
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-previous')

    expect(result.tenant).toBeDefined()
    expect(result.tenant?.leaseId).toBe('lease-previous')
    expect(result.newTenant).toBeDefined()
    expect(result.newTenant?.leaseId).toBe('lease-new')
  })

  it('should filter out parking space contracts', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-previous',
        leaseNumber: '001',
        leaseStartDate: new Date('2023-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-parking',
        leaseNumber: '002',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Parkeringskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-previous')

    expect(result.tenant?.leaseId).toBe('lease-previous')
    expect(result.newTenant).toBeNull()
  })

  it('should return null for both when inspectionLeaseId does not match any housing contract', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-1',
        leaseNumber: '001',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Parkeringskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'non-existent-lease')

    expect(result.newTenant).toBeNull()
    expect(result.tenant).toBeNull()
  })

  it('should return only tenant when no other lease exists', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-previous',
        leaseNumber: '001',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-previous')

    expect(result.tenant?.leaseId).toBe('lease-previous')
    expect(result.newTenant).toBeNull()
  })

  it('should find the latest lease as new tenant regardless of input order', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-old',
        leaseNumber: '001',
        leaseStartDate: new Date('2020-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-newest',
        leaseNumber: '002',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-middle',
        leaseNumber: '003',
        leaseStartDate: new Date('2022-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-middle')

    expect(result.tenant?.leaseId).toBe('lease-middle')
    expect(result.newTenant?.leaseId).toBe('lease-newest')
  })

  it('should pick the latest lease as new tenant, not just the next one after inspection lease', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-oldest',
        leaseNumber: '001',
        leaseStartDate: new Date('2020-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-middle',
        leaseNumber: '002',
        leaseStartDate: new Date('2022-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-newest',
        leaseNumber: '003',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: undefined,
        status: 'Active' as any,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    // When inspection lease is the oldest, new tenant should be the latest (not the middle one)
    const result = identifyTenantContracts(leases, 'lease-oldest')

    expect(result.tenant?.leaseId).toBe('lease-oldest')
    expect(result.newTenant?.leaseId).toBe('lease-newest')
  })

  it('should not select an ended lease as new tenant', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-previous',
        leaseNumber: '001',
        leaseStartDate: new Date('2023-01-01'),
        leaseEndDate: new Date('2023-12-31'),
        status: LeaseStatus.Ended,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-ended',
        leaseNumber: '002',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: new Date('2024-06-30'),
        status: LeaseStatus.Ended,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-previous')

    expect(result.tenant?.leaseId).toBe('lease-previous')
    expect(result.newTenant).toBeNull()
  })

  it('should select the latest active lease as new tenant when ended leases exist', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-inspection',
        leaseNumber: '001',
        leaseStartDate: new Date('2022-01-01'),
        leaseEndDate: new Date('2022-12-31'),
        status: LeaseStatus.Ended,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-active',
        leaseNumber: '002',
        leaseStartDate: new Date('2023-01-01'),
        leaseEndDate: undefined,
        status: LeaseStatus.Current,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
      {
        leaseId: 'lease-ended-latest',
        leaseNumber: '003',
        leaseStartDate: new Date('2024-01-01'),
        leaseEndDate: new Date('2024-06-30'),
        status: LeaseStatus.Ended,
        type: 'Bostadskontrakt',
        rentalPropertyId: 'prop-1',
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
      },
    ]

    const result = identifyTenantContracts(leases, 'lease-inspection')

    expect(result.tenant?.leaseId).toBe('lease-inspection')
    // Should pick the active lease, not the ended one even though it has a later start date
    expect(result.newTenant?.leaseId).toBe('lease-active')
  })
})

describe('sendProtocolToTenants', () => {
  const mockInspection: DetailedInspection = {
    id: '123',
    status: 'Completed',
    date: new Date('2024-01-15'),
    startedAt: new Date('2024-01-15T10:00:00Z'),
    endedAt: new Date('2024-01-15T11:00:00Z'),
    inspector: 'Inspector Name',
    type: 'Inflyttningsbesiktning',
    residenceId: 'res-1',
    address: 'Testgatan 1',
    apartmentCode: 'A101',
    isFurnished: false,
    leaseId: 'lease-1',
    isTenantPresent: true,
    isNewTenantPresent: true,
    masterKeyAccess: null,
    hasRemarks: false,
    notes: null,
    totalCost: 0,
    remarkCount: 0,
    rooms: [],
    lease: null,
    residence: null,
  }

  const mockContact: Contact = {
    contactCode: 'contact-1',
    contactKey: 'key-1',
    firstName: 'Test',
    lastName: 'Tenant',
    fullName: 'Test Tenant',
    nationalRegistrationNumber: '1234567890',
    birthDate: new Date('1990-01-01'),
    address: undefined,
    phoneNumbers: undefined,
    emailAddress: 'test@example.com',
    isTenant: true,
  }

  const mockLease: Lease = {
    leaseId: 'lease-1',
    leaseNumber: '001',
    leaseStartDate: new Date('2024-01-01'),
    leaseEndDate: undefined,
    status: 'Active' as any,
    type: 'Bostadskontrakt',
    rentalPropertyId: 'prop-1',
    tenantContactIds: ['contact-1'],
    tenants: [mockContact],
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
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send protocol to tenant with email address', async () => {
    const mockSendFn = jest
      .spyOn(communicationAdapter, 'sendInspectionProtocolEmail')
      .mockResolvedValue({ ok: true, data: null })

    const pdfBuffer = Buffer.from('mock pdf content')
    const result = await sendProtocolToTenants(
      mockInspection,
      pdfBuffer,
      mockLease,
      'new-tenant'
    )

    expect(result.success).toBe(true)
    expect(result.emails).toContain('test@example.com')
    expect(result.contactNames).toContain('Test Tenant')
    expect(result.contractId).toBe('lease-1')
    expect(mockSendFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Besiktningsprotokoll'),
        firstName: 'Test',
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: expect.stringContaining('.pdf'),
            content: pdfBuffer.toString('base64'),
            contentType: 'application/pdf',
          }),
        ]),
      })
    )
  })

  it('should return error when no tenants on contract', async () => {
    const emptyLease: Lease = {
      ...mockLease,
      tenants: [],
    }

    const pdfBuffer = Buffer.from('mock pdf content')
    const result = await sendProtocolToTenants(
      mockInspection,
      pdfBuffer,
      emptyLease,
      'new-tenant'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('No tenant contacts found on contract')
  })

  it('should return error when tenants have no email addresses', async () => {
    const leaseWithoutEmail: Lease = {
      ...mockLease,
      tenants: [
        {
          ...mockContact,
          emailAddress: undefined,
        },
      ],
    }

    const pdfBuffer = Buffer.from('mock pdf content')
    const result = await sendProtocolToTenants(
      mockInspection,
      pdfBuffer,
      leaseWithoutEmail,
      'new-tenant'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('No email addresses found for tenant')
  })

  it('should send to multiple tenants on same lease', async () => {
    const mockSendFn = jest
      .spyOn(communicationAdapter, 'sendInspectionProtocolEmail')
      .mockResolvedValue({ ok: true, data: null })

    const multipleTenants: Lease = {
      ...mockLease,
      tenants: [
        mockContact,
        {
          ...mockContact,
          contactCode: 'contact-2',
          fullName: 'Second Tenant',
          emailAddress: 'second@example.com',
        },
      ],
    }

    const pdfBuffer = Buffer.from('mock pdf content')
    const result = await sendProtocolToTenants(
      mockInspection,
      pdfBuffer,
      multipleTenants,
      'new-tenant'
    )

    expect(result.success).toBe(true)
    expect(result.emails).toHaveLength(2)
    expect(result.emails).toContain('test@example.com')
    expect(result.emails).toContain('second@example.com')
    expect(mockSendFn).toHaveBeenCalledTimes(2)
  })

  it('should handle partial failures when sending to multiple tenants', async () => {
    const mockSendFn = jest
      .spyOn(communicationAdapter, 'sendInspectionProtocolEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })

    const multipleTenants: Lease = {
      ...mockLease,
      tenants: [
        mockContact,
        {
          ...mockContact,
          contactCode: 'contact-2',
          fullName: 'Second Tenant',
          emailAddress: 'second@example.com',
        },
      ],
    }

    const pdfBuffer = Buffer.from('mock pdf content')
    const result = await sendProtocolToTenants(
      mockInspection,
      pdfBuffer,
      multipleTenants,
      'new-tenant'
    )

    expect(result.success).toBe(true) // At least one succeeded
    expect(result.emails).toHaveLength(1)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('Failed to send')
  })
})
