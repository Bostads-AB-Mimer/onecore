jest.mock('../../../adapters/tenfast/tenfast-api', () => ({
  request: jest.fn(),
}))

import * as tenfastAdapter from '../../../adapters/tenfast/tenfast-adapter'
import { request } from '../../../adapters/tenfast/tenfast-api'
import * as factory from '../../factories'

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

describe(tenfastAdapter.createInvoiceRow, () => {
  it('creates and returns invoice row', async () => {
    const invoiceRow = factory.tenfastInvoiceRow.build()

    ;(request as jest.Mock).mockResolvedValue({
      status: 200,
      data: invoiceRow,
    })

    const result = await tenfastAdapter.createInvoiceRow({
      leaseId: 'lease-id',
      invoiceRow: invoiceRow,
    })

    expect(result).toEqual({ ok: true, data: invoiceRow })
  })

  it('returns ok false on error', async () => {
    const invoiceRow = factory.tenfastInvoiceRow.build()

    ;(request as jest.Mock).mockResolvedValue({
      status: 500,
      data: invoiceRow,
    })

    const result = await tenfastAdapter.createInvoiceRow({
      leaseId: 'lease-id',
      invoiceRow: invoiceRow,
    })

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(tenfastAdapter.deleteInvoiceRow, () => {
  it('deletes and returns null', async () => {
    ;(request as jest.Mock).mockResolvedValue({
      status: 200,
    })

    const result = await tenfastAdapter.deleteInvoiceRow({
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

    const result = await tenfastAdapter.deleteInvoiceRow({
      leaseId: 'lease-id',
      invoiceRowId: 'invoice-row-id',
    })
    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
