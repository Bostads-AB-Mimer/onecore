jest.mock('../../../adapters/tenfast/tenfast-api', () => ({
  request: jest.fn(),
}))

import * as tenfastAdapter from '../../../adapters/tenfast/tenfast-adapter'
import { request } from '../../../adapters/tenfast/tenfast-api'
import * as factory from './factories'

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
    const mockRentalObject = factory.tenfastRentalObject.build()
    const mockResponse = {
      status: 200,
      data: mockRentalObject,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockRentalObject.records[0],
    })
  })

  it('should return rental object when response is valid and status is 201', async () => {
    // Arrange
    const mockRentalObject = factory.tenfastRentalObject.build()
    const mockResponse = {
      status: 201,
      data: mockRentalObject,
    }
    ;(request as jest.Mock).mockResolvedValue(mockResponse)

    // Act
    const result = await tenfastAdapter.getRentalObject('RENTAL_CODE')

    // Assert
    expect(result).toEqual({
      ok: true,
      data: mockRentalObject.records[0],
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
      err: 'get-lease-bad-request',
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
  //   it('should return tenant when response is valid and status is 200', async () => {
  //     // Arrange
  //     const mockTenant = factory.tenfastTenant.build()
  //     const mockResponse = {
  //       status: 200,
  //       data: { records: [mockTenant] },
  //     }
  //     ;(request as jest.Mock).mockResolvedValue(mockResponse)

  //     // Act
  //     const result = await tenfastAdapter.getTenantByContactCode('TENANT_CODE')

  //     // Assert
  //     expect(result).toEqual({
  //       ok: true,
  //       data: mockTenant,
  //     })
  //   })

  it.todo('should return tenant when response is valid and status is 201')
  it.todo(
    'should return null when response is valid but records array is empty'
  )
  it.todo('should return error "get-tenant-bad-request" when status is 400')
  it.todo(
    'should return error "could-not-retrieve-tenant" when status is not 200, 201, or 400'
  )
  it.todo(
    'should return error "could-not-parse-tenant-response" when schema parsing fails'
  )
  it.todo(
    'should return error "unknown" when tenfastApiRequest throws an exception'
  )
})

describe(tenfastAdapter.createTenant, () => {
  it.todo('should return tenant when response is valid and status is 200')
  it.todo('should return tenant when response is valid and status is 201')
  it.todo('should return error "create-tenant-bad-request" when status is 400')
  it.todo(
    'should return error "tenant-could-not-be-created" when status is not 200, 201, or 400'
  )
  it.todo(
    'should return error "tenant-could-not-be-parsed" when schema parsing fails'
  )
})

describe(tenfastAdapter.createLease, () => {
  it.todo('should return lease when all dependencies succeed and status is 200')
  it.todo('should return lease when all dependencies succeed and status is 201')
  it.todo(
    'should return error "could-not-find-template" when getLeaseTemplate fails or returns no data'
  )
  it.todo(
    'should return error "could-not-retrieve-tenant" when getOrCreateTenant fails or returns no data'
  )
  it.todo(
    'should return error "could-not-find-rental-object" when getRentalObject fails or returns no data'
  )
  it.todo(
    'should return error "create-lease-bad-request" when leaseResponse status is 400'
  )
  it.todo(
    'should return error "lease-could-not-be-created" when leaseResponse status is not 200, 201, or 400'
  )
  it.todo(
    'should return error "lease-could-not-be-created" when tenfastApiRequest throws an exception'
  )
})
