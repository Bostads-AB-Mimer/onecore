import { Lease, Contact } from '@onecore/types'
import {
  identifyTenantContracts,
  generateInspectionEmailContent,
  sendProtocolToTenants,
} from '../email-sender'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import type { DetailedInspection } from '../../schemas'

// Mock the communication adapter
jest.mock('../../../../adapters/communication-adapter')

describe('identifyTenantContracts', () => {
  it('should identify new and previous tenant from housing contracts', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-1',
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
        leaseId: 'lease-2',
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

    const result = identifyTenantContracts(leases)

    expect(result.newTenant).toBeDefined()
    expect(result.newTenant?.leaseId).toBe('lease-1')
    expect(result.previousTenant).toBeDefined()
    expect(result.previousTenant?.leaseId).toBe('lease-2')
  })

  it('should filter out parking space contracts', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-1',
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
      {
        leaseId: 'lease-2',
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

    const result = identifyTenantContracts(leases)

    expect(result.newTenant?.leaseId).toBe('lease-1')
    expect(result.previousTenant).toBeNull()
  })

  it('should return null when no housing contracts exist', () => {
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

    const result = identifyTenantContracts(leases)

    expect(result.newTenant).toBeNull()
    expect(result.previousTenant).toBeNull()
  })

  it('should return only new tenant when only one housing contract exists', () => {
    const leases: Lease[] = [
      {
        leaseId: 'lease-1',
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

    const result = identifyTenantContracts(leases)

    expect(result.newTenant?.leaseId).toBe('lease-1')
    expect(result.previousTenant).toBeNull()
  })

  it('should sort by leaseStartDate descending (newest first)', () => {
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

    const result = identifyTenantContracts(leases)

    expect(result.newTenant?.leaseId).toBe('lease-newest')
    expect(result.previousTenant?.leaseId).toBe('lease-middle')
  })
})

describe('generateInspectionEmailContent', () => {
  it('should generate email content in Swedish', () => {
    const inspection: DetailedInspection = {
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

    const result = generateInspectionEmailContent(inspection, 'new-tenant')

    expect(result.subject).toContain('Besiktningsprotokoll')
    expect(result.subject).toContain('Inflyttningsbesiktning')
    expect(result.subject).toContain('Testgatan 1')
    expect(result.message).toContain('Hej,')
    expect(result.message).toContain('Testgatan 1')
    expect(result.message).toContain('Inflyttningsbesiktning')
    expect(result.message).toContain('A101')
    expect(result.message).toContain('Med vänlig hälsning,')
    expect(result.message).toContain('Mimer')
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
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValue(undefined)

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
      mockContact,
      expect.stringContaining('Besiktningsprotokoll'),
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          filename: expect.stringContaining('.pdf'),
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }),
      ])
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
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValue(undefined)

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
      .spyOn(communicationAdapter, 'sendNotificationToContactWithAttachment')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Send failed'))

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
