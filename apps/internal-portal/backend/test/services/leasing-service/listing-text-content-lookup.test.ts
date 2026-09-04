import { RentalPropertyInfo } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { getListingTextContentLookup } from '@/services/leasing-service/helpers/listing-text-content-lookup'
import * as leasingCoreAdapter from '@/services/leasing-service/adapters/core-adapter'
import * as propertyBaseCoreAdapter from '@/services/property-base-service/adapters/core-adapter'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  generateRouteMetadata: jest.fn(),
}))

const mockedLogger = logger as jest.Mocked<typeof logger>

jest.mock('@/services/leasing-service/adapters/core-adapter')
jest.mock('@/services/property-base-service/adapters/core-adapter')

const mockedLeasingCoreAdapter = leasingCoreAdapter as jest.Mocked<
  typeof leasingCoreAdapter
>
const mockedPropertyBaseCoreAdapter = propertyBaseCoreAdapter as jest.Mocked<
  typeof propertyBaseCoreAdapter
>

const listingTextContent = {
  id: 'a1111111-1111-1111-1111-111111111111',
  rentalObjectCode: '123-456-789',
  contentBlocks: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const listingAreaTextContent = {
  id: 'b2222222-2222-2222-2222-222222222222',
  marketAreaCode: 'VAL',
  contentBlocks: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const housingRentalProperty: RentalPropertyInfo = {
  id: '123-456-789',
  type: 'Lägenhet',
  property: {
    rentalTypeCode: 'RT',
    rentalType: 'Rental type',
    address: 'Street 1',
    code: '789',
    number: '1001',
    type: 'Apartment',
    roomTypeCode: '2RK',
    entrance: 'A',
    floor: '1',
    hasElevator: false,
    washSpace: 'Y',
    area: 55,
    estateCode: 'PROP-1',
    estate: 'Property 1',
    buildingCode: 'BLD-1',
    building: 'Building 1',
  },
}

const parkingSpaceRentalProperty: RentalPropertyInfo = {
  id: '999-999-999',
  type: 'Bilplats',
  property: {
    rentalTypeCode: 'RT',
    rentalType: 'Rental type',
    address: 'Street 2',
    code: 'P1',
  },
}

const housingRentalPropertyWithEmptyEstateCode: RentalPropertyInfo = {
  ...housingRentalProperty,
  property: {
    ...housingRentalProperty.property,
    estateCode: '',
  },
}

// estateCode is typed as string but Xpand can deliver NULL (babuf.fstcode);
// the cast reproduces that runtime shape.
const housingRentalPropertyWithNullEstateCode: RentalPropertyInfo = {
  ...housingRentalProperty,
  property: {
    ...housingRentalProperty.property,
    estateCode: null as unknown as string,
  },
}

describe('getListingTextContentLookup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns content, market area and area text for housing with area text', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })
    mockedPropertyBaseCoreAdapter.getPropertyDetails.mockResolvedValueOnce({
      ok: true,
      data: { marketArea: { id: 'mkt-1', code: 'VAL', name: 'Vallby' } },
    })
    mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode.mockResolvedValueOnce(
      { ok: true, data: listingAreaTextContent }
    )

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: { code: 'VAL', name: 'Vallby' },
        areaContent: listingAreaTextContent,
      },
    })
  })

  it('returns null area text when housing has no area text (404)', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })
    mockedPropertyBaseCoreAdapter.getPropertyDetails.mockResolvedValueOnce({
      ok: true,
      data: { marketArea: { id: 'mkt-1', code: 'VAL', name: 'Vallby' } },
    })
    mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode.mockResolvedValueOnce(
      { ok: false, err: 'not-found', statusCode: 404 }
    )

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: { code: 'VAL', name: 'Vallby' },
        areaContent: null,
      },
    })
  })

  it('returns null market area and area text when the property has no market area', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })
    mockedPropertyBaseCoreAdapter.getPropertyDetails.mockResolvedValueOnce({
      ok: true,
      data: { marketArea: null },
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode
    ).not.toHaveBeenCalled()
  })

  it('returns null market area and area text when the property lookup fails', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })
    mockedPropertyBaseCoreAdapter.getPropertyDetails.mockResolvedValueOnce({
      ok: false,
      err: 'not-found',
      statusCode: 404,
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode
    ).not.toHaveBeenCalled()
  })

  it('returns nulls for parking spaces without calling property/area adapters', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: parkingSpaceRentalProperty,
    })

    const result = await getListingTextContentLookup('999-999-999')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
    expect(
      mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode
    ).not.toHaveBeenCalled()
  })

  it('returns nulls for housing with an empty estateCode without calling property/area adapters', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalPropertyWithEmptyEstateCode,
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
    expect(
      mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode
    ).not.toHaveBeenCalled()
  })

  it('returns nulls for housing with a null estateCode without calling property/area adapters', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalPropertyWithNullEstateCode,
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
    expect(
      mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode
    ).not.toHaveBeenCalled()
  })

  it('returns nulls and logs an error when the rental property lookup fails unexpectedly', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: false,
      err: 'unknown',
      statusCode: 500,
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(mockedLogger.error).toHaveBeenCalledTimes(1)
    expect(mockedLogger.info).not.toHaveBeenCalled()
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
  })

  it('returns nulls when the rental property lookup 404s', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: true, data: listingTextContent }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: false,
      err: 'not-found',
      statusCode: 404,
    })

    const result = await getListingTextContentLookup('unknown-code')

    expect(result).toEqual({
      ok: true,
      data: {
        content: listingTextContent,
        marketArea: null,
        areaContent: null,
      },
    })
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
  })

  it('returns not ok when the object text lookup fails unexpectedly', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: false, err: 'request-failed', statusCode: 500 }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: false,
      err: 'request-failed',
      statusCode: 500,
    })
    expect(
      mockedPropertyBaseCoreAdapter.getPropertyDetails
    ).not.toHaveBeenCalled()
  })

  it('returns null content with area text when object text is missing but area text exists', async () => {
    mockedLeasingCoreAdapter.getListingTextContentByRentalObjectCode.mockResolvedValueOnce(
      { ok: false, err: 'not-found', statusCode: 404 }
    )
    mockedLeasingCoreAdapter.getRentalPropertyByCode.mockResolvedValueOnce({
      ok: true,
      data: housingRentalProperty,
    })
    mockedPropertyBaseCoreAdapter.getPropertyDetails.mockResolvedValueOnce({
      ok: true,
      data: { marketArea: { id: 'mkt-1', code: 'VAL', name: 'Vallby' } },
    })
    mockedLeasingCoreAdapter.getListingAreaTextContentByMarketAreaCode.mockResolvedValueOnce(
      { ok: true, data: listingAreaTextContent }
    )

    const result = await getListingTextContentLookup('123-456-789')

    expect(result).toEqual({
      ok: true,
      data: {
        content: null,
        marketArea: { code: 'VAL', name: 'Vallby' },
        areaContent: listingAreaTextContent,
      },
    })
  })
})
