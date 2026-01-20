jest.mock('../../../adapters/tenfast/tenfast-api', () => ({
  request: jest.fn(),
}))

import assert from 'node:assert'
import * as tenfastAdapter from '../../../adapters/tenfast/tenfast-adapter'
import { request } from '../../../adapters/tenfast/tenfast-api'
import * as factory from '../../factories'
import { toYearMonthString } from '../../../adapters/tenfast/schemas'

describe(tenfastAdapter.getLeaseTemplate, () => {
  it('should return template when response is valid and status is 200', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    const mockResponse = {
      status: 200,
      data: mockTemplate,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getLeaseTemplate('PARKING_SPACE')

    // Assert
    expect(result).toEqual({ ok: true, data: mockTemplate })
  })

  it('should return error "could-not-find-template-for-category" for unknown listingCategory', async () => {
    // Act
    const result = await tenfastAdapter.getLeaseTemplate(
      'UNKNOWN_CATEGORY' as any
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-find-template-for-category',
    })
  })

  it('should return error "get-template-bad-request" when status is 400', async () => {
    // Arrange
    const mockResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getLeaseTemplate('PARKING_SPACE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'get-template-bad-request',
    })
  })

  it('should return error "could-not-get-template" when status is not 200 or 400', async () => {
    // Arrange
    const mockResponse = {
      status: 500,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getLeaseTemplate('PARKING_SPACE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-get-template',
    })
  })

  it('should return error "response-could-not-be-parsed" when schema parsing fails', async () => {
    // Arrange
    // Return a response with status 200 but invalid data for the schema
    const invalidData = { notAValidTemplate: true }
    const mockResponse = {
      status: 200,
      data: invalidData,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getLeaseTemplate('PARKING_SPACE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'response-could-not-be-parsed',
    })
  })

  it('should return error "unknown" when tenfastApiRequest throws an exception', async () => {
    // Arrange
    ;(request as jest.Mock).mockRejectedValue(new Error('Network error'))

    // Act
    const result = await tenfastAdapter.getLeaseTemplate('PARKING_SPACE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'unknown',
    })
  })
})

describe(tenfastAdapter.getRentalObject, () => {
  it('should return rental object when response is valid and status is 200', async () => {
    // Arrange
    const mockRentalObjectResponse = factory.tenfastRentalObjectResponse.build()
    const mockResponse = {
      status: 200,
      data: mockRentalObjectResponse,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockRentalObjectResponse.records[0],
    })
  })

  it('should return rental object when response is valid and status is 201', async () => {
    // Arrange
    const mockRentalObjectResponse = factory.tenfastRentalObjectResponse.build()
    const mockResponse = {
      status: 201,
      data: mockRentalObjectResponse,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockRentalObjectResponse.records[0],
    })
  })

  it('should return null when response is valid but records array is empty', async () => {
    // Arrange
    const mockResponse = {
      status: 200,
      data: { records: [] },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('should return error "get-lease-bad-request" when status is 400', async () => {
    // Arrange
    const mockResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'get-rental-object-bad-request',
    })
  })

  it('should return error "could-not-find-rental-object" when status is not 200, 201, or 400', async () => {
    // Arrange
    const mockResponse = {
      status: 500,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-find-rental-object',
    })
  })

  it('should return error "could-not-parse-rental-object" when schema parsing fails', async () => {
    // Arrange
    // Return a response with status 200 and invalid data for the schema
    const invalidData = { notARentalObject: true }
    const mockResponse = {
      status: 200,
      data: invalidData,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-parse-rental-object',
    })
  })

  it('should return error "could-not-find-rental-object" when request throws an exception', async () => {
    // Arrange
    ;(request as jest.Mock).mockRejectedValue(new Error('Network error'))

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-find-rental-object',
    })
  })
})

describe(tenfastAdapter.getTenantByContactCode, () => {
  it('should return tenant when response is valid and status is 200', async () => {
    // Arrange
    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    const mockResponse = {
      status: 200,
      data: mockTenant,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockTenant.records[0],
    })
  })

  it('should return tenant when response is valid and status is 201', async () => {
    // Arrange
    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    const mockResponse = {
      status: 201,
      data: mockTenant,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockTenant.records[0],
    })
  })

  it('should return null when response is valid but records array is empty', async () => {
    // Arrange
    const mockResponse = {
      status: 200,
      data: { records: [] },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('should return error "get-tenant-bad-request" when status is 400', async () => {
    // Arrange
    const mockResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'get-tenant-bad-request',
    })
  })

  it('should return error "could-not-retrieve-tenant" when status is not 200, 201, or 400', async () => {
    // Arrange
    const mockResponse = {
      status: 500,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-retrieve-tenant',
    })
  })

  it('should return error "could-not-parse-tenant-response" when schema parsing fails', async () => {
    // Arrange
    // Return a response with status 200 and invalid data for the schema
    const invalidData = { notATenant: true }
    const mockResponse = {
      status: 200,
      data: invalidData,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-parse-tenant-response',
    })
  })

  it('should return error "unknown" when tenfastApiRequest throws an exception', async () => {
    // Arrange
    ;(request as jest.Mock).mockRejectedValue(new Error('Network error'))

    // Act
    const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'unknown',
    })
  })
})

describe(tenfastAdapter.createTenant, () => {
  it('should return tenant when response is valid and status is 200', async () => {
    // Arrange
    const mockTenant = factory.tenfastTenant.build()
    const mockResponse = {
      status: 200,
      data: mockTenant,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const contact = factory.contact.build()
    const result = await tenfastAdapter.createTenant(contact)

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockTenant,
    })
  })

  it('should return tenant when response is valid and status is 201', async () => {
    // Arrange
    const mockTenant = factory.tenfastTenant.build()
    const mockResponse = {
      status: 201,
      data: mockTenant,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const contact = factory.contact.build()
    const result = await tenfastAdapter.createTenant(contact)

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockTenant,
    })
  })

  it('should return error "create-tenant-bad-request" when status is 400', async () => {
    // Arrange
    const mockResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const contact = factory.contact.build()
    const result = await tenfastAdapter.createTenant(contact)

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'create-tenant-bad-request',
    })
  })

  it('should return error "tenant-could-not-be-created" when status is not 200, 201, or 400', async () => {
    // Arrange
    const mockResponse = {
      status: 500,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const contact = factory.contact.build()
    const result = await tenfastAdapter.createTenant(contact)

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'tenant-could-not-be-created',
    })
  })

  it('should return error "tenant-could-not-be-parsed" when schema parsing fails', async () => {
    // Arrange
    // Return a response with status 200 and invalid data for the schema
    const invalidData = { notATenant: true }
    const mockResponse = {
      status: 200,
      data: invalidData,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const contact = factory.contact.build()
    const result = await tenfastAdapter.createTenant(contact)

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'tenant-could-not-be-parsed',
    })
  })
})

describe(tenfastAdapter.createLease, () => {
  it('should return lease when all dependencies succeed and status is 200', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })

    // Mock tenfastApi.request to return a successful lease response
    const mockLeaseResponse = {
      status: 200,
      data: { leaseId: 'LEASE123' }, // adjust to expected structure if needed
    }
    ;(request as jest.Mock).mockResolvedValue(mockLeaseResponse)

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: true,
      data: undefined, // adjust if you implement schema parsing for lease response
    })
  })

  it('should set vat to 0.25 in lease request data when includeVAT is true', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest
      .spyOn(tenfastAdapter, 'getLeaseTemplate')
      .mockResolvedValue({ ok: true, data: mockTemplate })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: mockTenant.records[0] })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValue({ ok: true, data: mockRentalObject })

    let leaseRequestData: any
    ;(request as jest.Mock).mockImplementation((data) => {
      leaseRequestData = data.data
      return Promise.resolve({ status: 200, data: {} })
    })

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(leaseRequestData.hyror[0].vat).toBe(0.25)
    expect(leaseRequestData.vatEnabled).toBe(true)
  })

  it('should set vat to 0 in lease request data when includeVAT is false', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest
      .spyOn(tenfastAdapter, 'getLeaseTemplate')
      .mockResolvedValue({ ok: true, data: mockTemplate })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: mockTenant.records[0] })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValue({ ok: true, data: mockRentalObject })

    let leaseRequestData: any
    ;(request as jest.Mock).mockImplementation((data) => {
      leaseRequestData = data.data
      return Promise.resolve({ status: 200, data: {} })
    })

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      false
    )

    // Assert
    expect(leaseRequestData.hyror[0].vat).toBe(0)
    expect(leaseRequestData.vatEnabled).toBe(false)
  })

  it('should return lease when all dependencies succeed and status is 201', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })

    const mockLeaseResponse = {
      status: 201,
      data: { leaseId: 'LEASE123' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockLeaseResponse)

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: true,
      data: undefined, // adjust if you implement schema parsing for lease response
    })
  })

  it('should return error "could-not-find-template" when getLeaseTemplate fails or returns no data', async () => {
    // Arrange
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: false,
      err: 'could-not-find-template-for-category',
    })

    const contact = factory.contact.build()
    const fromDate = new Date()

    // Act
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-find-template',
    })
  })

  it('should return error "could-not-retrieve-tenant" when getOrCreateTenant fails or returns no data', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: false,
      err: 'could-not-retrieve-tenant',
    })

    const contact = factory.contact.build()
    const fromDate = new Date()

    // Act
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-retrieve-tenant',
    })
  })

  it('should return error "could-not-find-rental-object" when getRentalObject fails or returns no data', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: false,
      err: 'could-not-find-rental-object',
    })

    const contact = factory.contact.build()
    const fromDate = new Date()

    // Act
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'could-not-find-rental-object',
    })
  })

  it('should return error "rent-article-is-missing" when getRentalObject returns a rental object without rent article', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    mockRentalObject.hyror = [] // Remove rent articles to simulate missing rent article

    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })

    const contact = factory.contact.build()
    const fromDate = new Date()

    // Act
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'rent-article-is-missing',
    })
  })

  it('should return error "create-lease-bad-request" when leaseResponse status is 400', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })

    const mockLeaseResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockLeaseResponse)

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'create-lease-bad-request',
    })
  })

  it('should return error "lease-could-not-be-created" when leaseResponse status is not 200, 201, or 400', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })

    const mockLeaseResponse = {
      status: 500,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockLeaseResponse)

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'lease-could-not-be-created',
    })
  })

  it('should return error "lease-could-not-be-created" when tenfastApiRequest throws an exception', async () => {
    // Arrange
    const mockTemplate = factory.tenfastTemplate.build()
    jest.spyOn(tenfastAdapter, 'getLeaseTemplate').mockResolvedValue({
      ok: true,
      data: mockTemplate,
    })

    const mockTenant = factory.tenfastTenantByContactCodeResponse.build()
    jest.spyOn(tenfastAdapter, 'getTenantByContactCode').mockResolvedValue({
      ok: true,
      data: mockTenant.records[0],
    })

    const mockRentalObject = factory.tenfastRentalObject.build()
    jest.spyOn(tenfastAdapter, 'getRentalObject').mockResolvedValue({
      ok: true,
      data: mockRentalObject,
    })
    ;(request as jest.Mock).mockRejectedValue(new Error('Network error'))

    // Act
    const contact = factory.contact.build()
    const fromDate = new Date()
    const result = await tenfastAdapter.createLease(
      contact,
      'RENTAL_CODE',
      fromDate,
      'PARKING_SPACE',
      true
    )

    // Assert
    expect(result).toEqual({
      ok: false,
      err: 'lease-could-not-be-created',
    })
  })
})

describe(tenfastAdapter.createLeaseInvoiceRow, () => {
  it('creates and returns null', async () => {
    const invoiceRow = factory.tenfastInvoiceRow.build()

    ;(request as jest.Mock).mockResolvedValue({
      status: 200,
      data: invoiceRow,
    })

    const result = await tenfastAdapter.createLeaseInvoiceRow({
      leaseId: 'lease-id',
      invoiceRow: invoiceRow,
    })

    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns ok false on error', async () => {
    const invoiceRow = factory.tenfastInvoiceRow.build()

    ;(request as jest.Mock).mockResolvedValue({
      status: 500,
      data: invoiceRow,
    })

    const result = await tenfastAdapter.createLeaseInvoiceRow({
      leaseId: 'lease-id',
      invoiceRow: invoiceRow,
    })

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(tenfastAdapter.deleteLeaseInvoiceRow, () => {
  it('deletes and returns null', async () => {
    ;(request as jest.Mock).mockResolvedValue({
      status: 200,
    })

    const result = await tenfastAdapter.deleteLeaseInvoiceRow({
      leaseId: 'lease-id',
      invoiceRowId: 'invoice-row-id',
    })

    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns ok false on error', async () => {
    ;(request as jest.Mock).mockResolvedValue({
      status: 500,
      data: null,
    })

    const result = await tenfastAdapter.deleteLeaseInvoiceRow({
      leaseId: 'lease-id',
      invoiceRowId: 'invoice-row-id',
    })
    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
describe(tenfastAdapter.getRentForRentalObject, () => {
  it('should return rent when rental object is found and parsed', async () => {
    // Arrange
    const mockRentalObject = factory.tenfastRentalObject.build({
      externalId: '10011',
      hyra: 287.17,
    })

    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: mockRentalObject })

    // Act
    const result = await tenfastAdapter.getRentForRentalObject(
      mockRentalObject.externalId,
      true
    )

    // Assert
    assert(result.ok)
    expect(result.data).toEqual(
      expect.objectContaining({
        amount: 287.17,
      })
    )
  })

  it('should return error if getRentalObject returns not ok', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: false, err: 'could-not-find-rental-object' })

    // Act
    const result = await tenfastAdapter.getRentForRentalObject('NOTFOUND', true)

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('could-not-find-rental-object')
  })

  it('should return error if getRentalObject returns null data', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: null })

    // Act
    const result = await tenfastAdapter.getRentForRentalObject('NOTFOUND', true)

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('could-not-find-rental-object')
  })

  it('should return rent with correct VAT values when includeVAT is true', async () => {
    // Arrange
    const mockRentalObject = factory.tenfastRentalObject.build({
      _id: 'rent1',
      externalId: '123-456-789',
      hyra: 1000,
      hyraExcludingVat: 800,
      hyraVat: 200,
      hyror: [
        {
          _id: 'row1',
          amount: 800,
          vat: 200,
          label: 'Hyra',
          from: toYearMonthString(new Date('2023-01-01')),
          to: toYearMonthString(new Date('2023-12-31')),
          article: 'A1',
        },
      ],
    })
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: mockRentalObject })

    // Act
    const result = await tenfastAdapter.getRentForRentalObject(
      mockRentalObject.externalId,
      true
    )

    // Assert
    assert(result.ok)
    expect(result.data.amount).toBe(1000)
    expect(result.data.vat).toBe(200)
    expect(result.data.rows[0].amount).toBe(1000) // 800 + 200
    expect(result.data.rows[0].vatPercentage).toBe(200)
  })

  it('should return rent with correct VAT values when includeVAT is false', async () => {
    // Arrange
    const mockRentalObject = factory.tenfastRentalObject.build({
      _id: 'rent1',
      externalId: '123-456-789',
      hyra: 1000,
      hyraExcludingVat: 800,
      hyraVat: 200,
      hyror: [
        {
          _id: 'row1',
          amount: 800,
          vat: 200,
          label: 'Hyra',
          from: toYearMonthString(new Date('2023-01-01')),
          to: toYearMonthString(new Date('2023-12-31')),
          article: 'A1',
        },
      ],
    })
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: mockRentalObject })
    // Act
    const result = await tenfastAdapter.getRentForRentalObject(
      mockRentalObject.externalId,
      false
    )

    // Assert
    assert(result.ok)
    expect(result.data.amount).toBe(800)
    expect(result.data.vat).toBe(0)
    expect(result.data.rows[0].amount).toBe(800)
    expect(result.data.rows[0].vatPercentage).toBe(0)
  })
})

describe(tenfastAdapter.getRentalObjectRents, () => {
  it('should return rents for all provided rentalObjectCodes', async () => {
    // Arrange
    const rentalObjectCodes = ['R1001', 'R1002']
    const mockRentalObjects = [
      factory.tenfastRentalObject.build({
        externalId: 'R1001',
      }),
      factory.tenfastRentalObject.build({
        externalId: 'R1002',
      }),
    ]
    const mockResponse = {
      status: 200,
      data: mockRentalObjects,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(result.ok)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].rentalObjectCode).toBe('R1001')
    expect(result.data[1].rentalObjectCode).toBe('R1002')
  })

  it('should return error "get-rental-objects-bad-request" when status is 400', async () => {
    // Arrange
    const rentalObjectCodes = ['R1001', 'R1002']
    const mockResponse = {
      status: 400,
      data: { error: 'Bad request' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('get-rental-objects-bad-request')
  })

  it('should return error "could-not-find-rental-objects" when status is 404', async () => {
    // Arrange
    const rentalObjectCodes = ['R1001', 'R1002']
    const mockResponse = {
      status: 404,
      data: { error: 'Internal server error' },
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('could-not-find-rental-objects')
  })

  it('should throw and return error "could-not-parse-rental-objects" if schema parsing fails', async () => {
    // Arrange
    const rentalObjectCodes = ['R1001']
    // Return invalid data for the schema
    const mockResponse = {
      status: 200,
      data: [{ notARentalObject: true }],
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('could-not-parse-rental-objects')
  })

  it('should handle batching if more than 500 rentalObjectCodes are provided', async () => {
    // Arrange
    const rentalObjectCodes = Array.from(
      { length: 1001 },
      (_, i) => `R${i + 1}`
    )
    const batch1 = rentalObjectCodes.slice(0, 500).map((code) =>
      factory.tenfastRentalObject.build({
        externalId: code,
      })
    )
    const batch2 = rentalObjectCodes.slice(500, 1000).map((code) =>
      factory.tenfastRentalObject.build({
        externalId: code,
      })
    )
    const batch3 = rentalObjectCodes.slice(1000).map((code) =>
      factory.tenfastRentalObject.build({
        externalId: code,
      })
    )
    ;(request as jest.Mock)
      .mockResolvedValueOnce({ status: 200, data: batch1 })
      .mockResolvedValueOnce({ status: 200, data: batch2 })
      .mockResolvedValueOnce({ status: 200, data: batch3 })

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(result.ok)
    expect(result.data).toHaveLength(1001)
    expect(result.data[0].rentalObjectCode).toBe('R1')
    expect(result.data[1000].rentalObjectCode).toBe('R1001')
  })

  it('should return error "unknown" when request throws an exception', async () => {
    // Arrange
    const rentalObjectCodes = ['R1001', 'R1002']
    ;(request as jest.Mock).mockRejectedValue(new Error('Network error'))

    // Act
    const result = await tenfastAdapter.getRentalObjectRents(
      rentalObjectCodes,
      true
    )

    // Assert
    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })
})
