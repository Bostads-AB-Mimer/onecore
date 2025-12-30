import { logger } from '@onecore/utilities'
import createClient from 'openapi-fetch'

import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'

import config from '../../common/config'

const client = () =>
  createClient<paths>({
    baseUrl: config.propertyBaseService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

type SearchPropertiesResponse = components['schemas']['Property'][]
type DocumentWithUrl = components['schemas']['DocumentWithUrl']

export async function searchProperties(
  q: string
): Promise<AdapterResult<SearchPropertiesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/properties/search', {
      params: { query: { q } },
    })

    if (response.data) {
      return { ok: true, data: response.data.content ?? [] }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.searchProperties')
    return { ok: false, err: 'unknown' }
  }
}

type SearchBuildingsResponse = components['schemas']['Building'][]

export async function searchBuildings(
  q: string
): Promise<AdapterResult<SearchBuildingsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/buildings/search', {
      params: { query: { q } },
    })

    if (response.data) {
      return { ok: true, data: response.data.content ?? [] }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.searchBuildings')
    return { ok: false, err: 'unknown' }
  }
}

type SearchResidencesResponse = components['schemas']['ResidenceSearchResult'][]

export async function searchResidences(
  q: string
): Promise<AdapterResult<SearchResidencesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/residences/search', {
      params: { query: { q } },
    })

    if (response.data) {
      return { ok: true, data: response.data.content ?? [] }
    }

    throw { ok: false, err: 'missing response data invariant' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.searchResidences')
    return { ok: false, err: 'unknown' }
  }
}

type GetBuildingsResponse = components['schemas']['Building'][]

export async function getBuildings(
  propertyCode: string
): Promise<AdapterResult<GetBuildingsResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/buildings', {
      params: { query: { propertyCode } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getBuildings')
    return { ok: false, err: 'unknown' }
  }
}

type GetBuildingResponse = components['schemas']['Building']

export async function getBuildingById(
  buildingId: string
): Promise<AdapterResult<GetBuildingResponse, 'not-found' | 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/buildings/{id}', {
      params: { path: { id: buildingId } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getBuildingById')
    return { ok: false, err: 'unknown' }
  }
}

export async function getBuildingByCode(
  buildingCode: string
): Promise<AdapterResult<GetBuildingResponse, 'not-found' | 'unknown'>> {
  try {
    const fetchResponse = await client().GET(
      '/buildings/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode } },
      }
    )

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getBuilding')
    return { ok: false, err: 'unknown' }
  }
}

type GetCompaniesResponse = components['schemas']['Company'][]

export async function getCompanies(): Promise<
  AdapterResult<GetCompaniesResponse, 'unknown'>
> {
  try {
    const fetchResponse = await client().GET('/companies')

    if (fetchResponse.data?.content) {
      return {
        ok: true,
        data: fetchResponse.data.content,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, '@onecore/property-adapter.getCompanies')
    return { ok: false, err: 'unknown' }
  }
}

type GetPropertiesResponse = components['schemas']['Property'][]

export async function getProperties(
  companyCode: string,
  tract?: string
): Promise<AdapterResult<GetPropertiesResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/properties', {
      params: { query: { companyCode, tract } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getProperties')
    return { ok: false, err: 'unknown' }
  }
}

type GetPropertyDetailsResponse = components['schemas']['PropertyDetails']

export async function getPropertyDetails(
  propertyId: string
): Promise<AdapterResult<GetPropertyDetailsResponse, 'not-found' | 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/properties/{id}', {
      params: { path: { id: propertyId } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    throw new Error(
      `Unexpected response status: ${fetchResponse.response.status}`
    )
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getPropertyDetails')
    return { ok: false, err: 'unknown' }
  }
}

type GetResidencesResponse = components['schemas']['Residence'][]

export async function getResidences(
  buildingCode: string,
  staircaseCode?: string
): Promise<AdapterResult<GetResidencesResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/residences', {
      params: { query: { buildingCode, staircaseCode } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getResidences')
    return { ok: false, err: 'unknown' }
  }
}

type GetResidenceDetailsResponse = components['schemas']['ResidenceDetails']

export async function getResidenceDetails(
  residenceId: string,
  options?: { includeActiveBlocksOnly?: boolean }
): Promise<
  AdapterResult<GetResidenceDetailsResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET('/residences/{id}', {
      params: {
        path: { id: residenceId },
        query: {
          includeActiveBlocksOnly:
            options?.includeActiveBlocksOnly === true ? true : false,
        },
      },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    throw new Error(
      `Unexpected response status: ${fetchResponse.response.status}`
    )
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getResidenceDetails')
    return { ok: false, err: 'unknown' }
  }
}

type GetResidenceByRentalIdResponse =
  components['schemas']['GetResidenceByRentalIdResponse']['content']

export async function getResidenceByRentalId(
  rentalId: string
): Promise<
  AdapterResult<GetResidenceByRentalIdResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/residences/rental-id/{rentalId}',
      {
        params: { path: { rentalId: rentalId } },
      }
    )

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    throw new Error(
      `Unexpected response status: ${fetchResponse.response.status}`
    )
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getResidenceByRentalId')
    return { ok: false, err: 'unknown' }
  }
}

type GetStaircasesResponse = components['schemas']['Staircase'][]

export async function getStaircases(
  buildingCode: string
): Promise<AdapterResult<GetStaircasesResponse, 'not-found' | 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/staircases', {
      params: { query: { buildingCode } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getStaircases')
    return { ok: false, err: 'unknown' }
  }
}

type GetRoomsResponse = components['schemas']['Room'][]

export async function getRooms(
  residenceId: string
): Promise<AdapterResult<GetRoomsResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/rooms', {
      params: { query: { residenceId } },
    })

    if (!fetchResponse.data?.content) {
      throw { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getRooms')
    return { ok: false, err: 'unknown' }
  }
}

type SearchParkingSpacesResponse =
  components['schemas']['ParkingSpaceSearchResult'][]

export async function searchParkingSpaces(
  q: string
): Promise<AdapterResult<SearchParkingSpacesResponse, 'unknown'>> {
  const response = await client().GET('/parking-spaces/search', {
    params: { query: { q } },
  })
  if (response.data) {
    return { ok: true, data: response.data.content ?? [] }
  }
  throw { ok: false, err: 'missing response data invariant' }
}

type GetParkingSpaceResponse = components['schemas']['ParkingSpace']

export async function getParkingSpaceByRentalId(
  rentalId: string
): Promise<AdapterResult<GetParkingSpaceResponse, 'not-found' | 'unknown'>> {
  try {
    const response = await client().GET('/parking-spaces/by-rental-id/{id}', {
      params: { path: { id: rentalId } },
    })

    if (response.data?.content) {
      return { ok: true, data: response.data.content }
    }
    if (response.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getParkingSpaceByRentalId')
    return { ok: false, err: 'unknown' }
  }
}

type GetMaintenanceUnitsByRentalPropertyIdResponse =
  components['schemas']['MaintenanceUnit'][]

export async function getMaintenanceUnitsForRentalProperty(
  rentalPropertyId: string
): Promise<
  AdapterResult<GetMaintenanceUnitsByRentalPropertyIdResponse, 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/maintenance-units/by-rental-id/{id}',
      {
        params: { path: { id: rentalPropertyId } },
      }
    )
    if (!fetchResponse.data?.content) {
      throw { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error(
      { err },
      '@onecore/property-adapter.getMaintenanceUnitsForRentalProperty'
    )
    return { ok: false, err: 'unknown' }
  }
}

type GetMaintenanceUnitsByBuildingCodeResponse =
  components['schemas']['MaintenanceUnit'][]

export async function getMaintenanceUnitsByBuildingCode(
  buildingCode: string
): Promise<AdapterResult<GetMaintenanceUnitsByBuildingCodeResponse, unknown>> {
  try {
    const fetchResponse = await client().GET(
      '/maintenance-units/by-building-code/{code}',
      {
        params: { path: { code: buildingCode } },
      }
    )

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      { err },
      '@onecore/property-adapter.getMaintenanceUnitsByBuildingCode'
    )
    return { ok: false, err }
  }
}

type GetFacilityByRentalIdResponse =
  components['schemas']['GetFacilityByRentalIdResponse']['content']

export async function getFacilityByRentalId(
  rentalId: string
): Promise<
  AdapterResult<GetFacilityByRentalIdResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/facilities/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId } },
      }
    )

    if (fetchResponse.response.status === 404) {
      logger.info(
        { err: `Facility not found for rental id: ${rentalId}` },
        '@onecore/property-adapter.getFacilityByRentalId'
      )

      return { ok: false, err: 'not-found' }
    }

    if (!fetchResponse.data?.content) {
      throw 'Invariant: response data missing'
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getFacilityByRentalId')
    return { ok: false, err: 'unknown' }
  }
}

export async function getBuildingsByPropertyCode(
  propertyCode: string
): Promise<AdapterResult<GetBuildingsResponse, unknown>> {
  try {
    const fetchResponse = await client().GET('/buildings', {
      params: { query: { propertyCode } },
    })

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      { err },
      '@onecore/property-adapter.getBuildingsByPropertyCode'
    )
    return { ok: false, err }
  }
}

type GetMaintenanceUnitsByPropertyCodeResponse =
  components['schemas']['MaintenanceUnit'][]

export async function getMaintenanceUnitsByPropertyCode(
  propertyCode: string
): Promise<
  AdapterResult<GetMaintenanceUnitsByPropertyCodeResponse, 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/maintenance-units/by-property-code/{code}',
      {
        params: { path: { code: propertyCode } },
      }
    )
    if (!fetchResponse.data?.content) {
      throw { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error(
      { err },
      'property-base-adapter.getMaintenanceUnitsByPropertyCode'
    )
    return { ok: false, err: 'unknown' }
  }
}

type GetFacilitiesByPropertyCodeResponse =
  components['schemas']['GetFacilitiesByPropertyCodeResponse']['content']

export async function getFacilitiesByPropertyCode(
  propertyCode: string
): Promise<
  AdapterResult<GetFacilitiesByPropertyCodeResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/facilities/by-property-code/{propertyCode}',
      {
        params: { path: { propertyCode } },
      }
    )

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (!fetchResponse.data?.content) {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getFacilitiesByPropertyCode')
    return { ok: false, err: 'unknown' }
  }
}

type GetFacilitiesByBuildingCodeResponse =
  components['schemas']['GetFacilitiesByBuildingCodeResponse']['content']
export async function getFacilitiesByBuildingCode(
  buildingCode: string
): Promise<
  AdapterResult<GetFacilitiesByBuildingCodeResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/facilities/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode } },
      }
    )

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (!fetchResponse.data?.content) {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getFacilitiesByBuildingCode')
    return { ok: false, err: 'unknown' }
  }
}

type GetResidenceSummariesResponse = components['schemas']['ResidenceSummary'][]

export async function getResidenceSummariesByBuildingCode(
  buildingCode: string,
  staircaseCode?: string
): Promise<AdapterResult<GetResidenceSummariesResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET(
      '/residences/summary/by-building-code/{buildingCode}',
      {
        params: {
          path: { buildingCode },
          query: staircaseCode ? { staircaseCode } : {},
        },
      }
    )

    if (fetchResponse.data?.content) {
      return { ok: true, data: fetchResponse.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      { err },
      'property-base-adapter.getResidenceSummariesByBuildingCode'
    )
    return { ok: false, err: 'unknown' }
  }
}
// ==================== COMPONENT CATEGORIES ====================

type GetComponentCategoriesResponse =
  components['schemas']['ComponentCategory'][]

export async function getComponentCategories(
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentCategoriesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-categories' as any, {
      params: { query: { page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentCategories')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentCategoryResponse = components['schemas']['ComponentCategory']

export async function getComponentCategoryById(
  id: string
): Promise<
  AdapterResult<GetComponentCategoryResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET('/component-categories/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentCategoryById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponentCategory(
  data: components['schemas']['CreateComponentCategoryRequest']
): Promise<AdapterResult<GetComponentCategoryResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-categories', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponentCategory(
  id: string,
  data: components['schemas']['UpdateComponentCategoryRequest']
): Promise<
  AdapterResult<GetComponentCategoryResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-categories/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentCategory(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-categories/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT TYPES ====================

type GetComponentTypesResponse = components['schemas']['ComponentType'][]

export async function getComponentTypes(
  categoryId?: string,
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentTypesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-types' as any, {
      params: { query: { categoryId, page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentTypes')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentTypeResponse = components['schemas']['ComponentType']

export async function getComponentTypeById(
  id: string
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/component-types/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentTypeById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponentType(
  data: components['schemas']['CreateComponentTypeRequest']
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-types', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentType')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponentType(
  id: string,
  data: components['schemas']['UpdateComponentTypeRequest']
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/component-types/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentType')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentType(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-types/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentType')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT SUBTYPES ====================

type GetComponentSubtypesResponse = components['schemas']['ComponentSubtype'][]

export async function getComponentSubtypes(
  typeId?: string,
  page?: number,
  limit?: number,
  subtypeName?: string
): Promise<AdapterResult<GetComponentSubtypesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-subtypes' as any, {
      params: { query: { typeId, page, limit, subtypeName } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentSubtypes')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentSubtypeResponse = components['schemas']['ComponentSubtype']

export async function getComponentSubtypeById(
  id: string
): Promise<
  AdapterResult<GetComponentSubtypeResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET('/component-subtypes/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentSubtypeById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponentSubtype(
  data: components['schemas']['CreateComponentSubtypeRequest']
): Promise<AdapterResult<GetComponentSubtypeResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-subtypes', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponentSubtype(
  id: string,
  data: components['schemas']['UpdateComponentSubtypeRequest']
): Promise<
  AdapterResult<GetComponentSubtypeResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-subtypes/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentSubtype(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-subtypes/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT MODELS ====================

type GetComponentModelsResponse = components['schemas']['ComponentModel'][]

export async function getComponentModels(
  componentTypeId?: string,
  subtypeId?: string,
  manufacturer?: string,
  page?: number,
  limit?: number,
  modelName?: string
): Promise<AdapterResult<GetComponentModelsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-models' as any, {
      params: {
        query: {
          componentTypeId,
          subtypeId,
          manufacturer,
          page,
          limit,
          modelName,
        },
      },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentModels')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentModelResponse = components['schemas']['ComponentModel']

export async function getComponentModelById(
  id: string
): Promise<AdapterResult<GetComponentModelResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/component-models/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentModelById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponentModel(
  data: components['schemas']['CreateComponentModelRequest']
): Promise<AdapterResult<GetComponentModelResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-models', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponentModel(
  id: string,
  data: components['schemas']['UpdateComponentModelRequest']
): Promise<AdapterResult<GetComponentModelResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/component-models/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentModel(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-models/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENTS ====================

type GetComponentsResponse = components['schemas']['ComponentInstance'][]

export async function getComponents(
  modelId?: string,
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED',
  page?: number,
  limit?: number,
  serialNumber?: string
): Promise<AdapterResult<GetComponentsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/components' as any, {
      params: { query: { modelId, status, page, limit, serialNumber } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponents')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentResponse = components['schemas']['ComponentInstance']

export async function getComponentById(
  id: string
): Promise<AdapterResult<GetComponentResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/components/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponent(
  data: components['schemas']['CreateComponentRequest']
): Promise<AdapterResult<GetComponentResponse, 'unknown'>> {
  try {
    const response = await client().POST('/components', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponent')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponent(
  id: string,
  data: components['schemas']['UpdateComponentRequest']
): Promise<AdapterResult<GetComponentResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/components/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponent')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponent(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/components/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponent')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT INSTALLATIONS ====================

type GetComponentInstallationsResponse =
  components['schemas']['ComponentInstallation'][]

export async function getComponentInstallations(
  componentId?: string,
  spaceId?: string,
  buildingPartId?: string,
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentInstallationsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-installations' as any, {
      params: { query: { componentId, spaceId, buildingPartId, page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentInstallations')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentInstallationResponse =
  components['schemas']['ComponentInstallation']

export async function getComponentInstallationById(
  id: string
): Promise<
  AdapterResult<GetComponentInstallationResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET(
      '/component-installations/{id}' as any,
      {
        params: { path: { id } },
      }
    )

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentInstallationById')
    return { ok: false, err: 'unknown' }
  }
}

export async function createComponentInstallation(
  data: components['schemas']['CreateComponentInstallationRequest']
): Promise<AdapterResult<GetComponentInstallationResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-installations', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateComponentInstallation(
  id: string,
  data: components['schemas']['UpdateComponentInstallationRequest']
): Promise<
  AdapterResult<GetComponentInstallationResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-installations/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentInstallation(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-installations/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENTS BY ROOM ====================

type GetComponentsByRoomIdResponse =
  components['schemas']['ComponentInstance'][]

export async function getComponentsByRoomId(
  roomId: string
): Promise<
  AdapterResult<GetComponentsByRoomIdResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/components/by-room/{roomId}' as any,
      {
        params: { path: { roomId } },
      }
    )

    if ((fetchResponse.data as any)?.content) {
      return { ok: true, data: (fetchResponse.data as any).content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentsByRoomId')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT FILE UPLOADS ====================

export async function uploadComponentFile(
  componentId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  caption?: string
): Promise<
  AdapterResult<DocumentWithUrl, 'unknown' | 'bad_request' | 'forbidden'>
> {
  try {
    const FormData = (await import('form-data')).default
    const formData = new FormData()
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    })
    formData.append('componentInstanceId', componentId)
    if (caption) {
      formData.append('caption', caption)
    }

    const response = await client().POST('/documents/upload' as any, {
      body: formData as any,
      headers: formData.getHeaders() as any,
    })

    if (response.data) {
      return { ok: true, data: response.data as DocumentWithUrl }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: any) {
    if (err.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    if (err.response?.status === 403) {
      return { ok: false, err: 'forbidden' }
    }
    logger.error(
      { err, componentId },
      'property-base-adapter.uploadComponentFile'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getComponentFiles(
  componentId: string
): Promise<AdapterResult<DocumentWithUrl[], 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET(
      '/documents/component-instances/{id}' as any,
      {
        params: {
          path: { id: componentId } as any,
        },
      }
    )

    if (response.data) {
      return { ok: true, data: response.data as DocumentWithUrl[] }
    }

    return { ok: false, err: 'not_found' }
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, componentId },
      'property-base-adapter.getComponentFiles'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentFile(
  documentId: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    await client().DELETE('/documents/{id}' as any, {
      params: {
        path: { id: documentId } as any,
      },
    })

    return { ok: true, data: undefined }
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, documentId },
      'property-base-adapter.deleteComponentFile'
    )
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT MODEL DOCUMENTS ====================

export async function uploadComponentModelDocument(
  modelId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<
  AdapterResult<DocumentWithUrl, 'unknown' | 'bad_request' | 'forbidden'>
> {
  try {
    const FormData = (await import('form-data')).default
    const formData = new FormData()
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    })
    formData.append('componentModelId', modelId)

    const response = await client().POST('/documents/upload' as any, {
      body: formData as any,
      headers: formData.getHeaders() as any,
    })

    if (response.data) {
      return { ok: true, data: response.data as DocumentWithUrl }
    }

    return { ok: false, err: 'unknown' }
  } catch (err: any) {
    if (err.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    if (err.response?.status === 403) {
      return { ok: false, err: 'forbidden' }
    }
    logger.error(
      { err, modelId },
      'property-base-adapter.uploadComponentModelDocument'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getComponentModelDocuments(
  modelId: string
): Promise<AdapterResult<DocumentWithUrl[], 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET(
      '/documents/component-models/{id}' as any,
      {
        params: {
          path: { id: modelId } as any,
        },
      }
    )

    if (response.data) {
      return { ok: true, data: response.data as DocumentWithUrl[] }
    }

    return { ok: false, err: 'not_found' }
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, modelId },
      'property-base-adapter.getComponentModelDocuments'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function deleteComponentModelDocument(
  documentId: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    await client().DELETE('/documents/{id}' as any, {
      params: {
        path: { id: documentId } as any,
      },
    })

    return { ok: true, data: undefined }
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, documentId },
      'property-base-adapter.deleteComponentModelDocument'
    )
    return { ok: false, err: 'unknown' }
  }
}

// ==================== AI COMPONENT ANALYSIS ====================

export async function analyzeComponentImage(
  data: components['schemas']['AnalyzeComponentImageRequest']
): Promise<
  AdapterResult<components['schemas']['AIComponentAnalysis'], string>
> {
  try {
    const response = await client().POST('/components/analyze-image', {
      body: data as any,
    })

    // Cast to access error properties - openapi-fetch types don't include error responses
    const res = response as {
      data?: { content?: components['schemas']['AIComponentAnalysis'] }
      error?: { error?: string }
      response: { status: number }
    }

    // openapi-fetch returns errors in response.error, not as exceptions
    if (res.error) {
      const errorMessage = res.error?.error ?? 'AI analysis failed'
      return {
        ok: false,
        err: errorMessage,
        statusCode: res.response.status,
      }
    }

    if (res.data?.content) {
      return {
        ok: true,
        data: res.data.content,
      }
    }

    return { ok: false, err: 'AI analysis failed' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.analyzeComponentImage')
    return { ok: false, err: 'AI analysis failed' }
  }
}
