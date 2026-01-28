import { logger, PaginatedResponse } from '@onecore/utilities'
import createClient from 'openapi-fetch'
import axios from 'axios'

import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'

import config from '../../common/config'

type RentalBlockWithRentalObject =
  components['schemas']['RentalBlockWithRentalObject']

// Shared filter options for rental blocks (used by search and export)
interface RentalBlocksFilterOptions {
  q?: string
  fields?: string
  kategori?: string | string[]
  distrikt?: string | string[]
  blockReason?: string | string[]
  fastighet?: string | string[]
  fromDateGte?: string
  toDateLte?: string
  active?: boolean
}

interface SearchRentalBlocksOptions extends RentalBlocksFilterOptions {
  page?: number
  limit?: number
}

// Helper to normalize string | string[] to array (for API calls that expect arrays)
function toArray<T>(val: T | T[] | undefined): T[] | undefined {
  if (val === undefined) return undefined
  return Array.isArray(val) ? val : [val]
}

const client = () =>
  createClient<paths>({
    baseUrl: config.propertyBaseService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

type SearchPropertiesResponse = components['schemas']['Property'][]

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

type GetCompanyByIdResponse = components['schemas']['CompanyDetails']

export async function getCompanyById(
  id: string
): Promise<AdapterResult<GetCompanyByIdResponse, 'not-found' | 'unknown'>> {
  try {
    const fetchResponse = await client().GET('/companies/{id}', {
      params: { path: { id } },
    })

    if (fetchResponse.data?.content) {
      return {
        ok: true,
        data: fetchResponse.data.content,
      }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, '@onecore/property-adapter.getCompanyById')
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
  options?: { active?: boolean }
): Promise<
  AdapterResult<GetResidenceDetailsResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET('/residences/{id}', {
      params: {
        path: { id: residenceId },
        query: { active: options?.active },
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

export async function getRoomsByFacilityId(
  facilityId: string
): Promise<AdapterResult<GetRoomsResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET(
      '/rooms/by-facility-id/{facilityId}',
      {
        params: { path: { facilityId } },
      }
    )

    if (!fetchResponse.data?.content) {
      throw { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getRoomsByFacilityId')
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

type SearchFacilitiesResponse = components['schemas']['FacilitySearchResult'][]

export async function searchFacilities(
  q: string
): Promise<AdapterResult<SearchFacilitiesResponse, 'unknown'>> {
  const response = await client().GET('/facilities/search', {
    params: { query: { q } },
  })
  if (response.data) {
    return { ok: true, data: response.data.content ?? [] }
  }
  throw { ok: false, err: 'missing response data invariant' }
}

type SearchMaintenanceUnitsResponse = components['schemas']['MaintenanceUnit'][]

export async function searchMaintenanceUnits(
  q: string
): Promise<AdapterResult<SearchMaintenanceUnitsResponse, 'unknown'>> {
  const response = await client().GET('/maintenance-units/search', {
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

    // Return empty array for 404 (no maintenance units found)
    if (fetchResponse.response.status === 404) {
      return { ok: true, data: [] }
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

type GetMaintenanceUnitByCodeResponse = components['schemas']['MaintenanceUnit']

export async function getMaintenanceUnitByCode(
  code: string
): Promise<AdapterResult<GetMaintenanceUnitByCodeResponse, 'unknown'>> {
  try {
    const fetchResponse = await client().GET(
      '/maintenance-units/by-code/{code}',
      {
        params: { path: { code } },
      }
    )
    if (!fetchResponse.data?.content) {
      throw { ok: false, err: 'unknown' }
    }

    return { ok: true, data: fetchResponse.data.content }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getMaintenanceUnitByCode')
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

type GetRentalBlocksByRentalIdResponse = components['schemas']['RentalBlock'][]

export async function getRentalBlocksByRentalId(
  rentalId: string,
  options?: { active?: boolean }
): Promise<
  AdapterResult<GetRentalBlocksByRentalIdResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/residences/rental-id/{rentalId}/rental-blocks',
      {
        params: {
          path: { rentalId },
          query: { active: options?.active },
        },
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
    logger.error({ err }, 'property-base-adapter.getRentalBlocksByRentalId')
    return { ok: false, err: 'unknown' }
  }
}

export async function getAllRentalBlocks(options?: {
  active?: boolean
  page?: number
  limit?: number
}): Promise<
  AdapterResult<PaginatedResponse<RentalBlockWithRentalObject>, 'unknown'>
> {
  try {
    const page = options?.page ?? 1
    const limit = options?.limit ?? 20

    const fetchResponse = await client().GET('/residences/rental-blocks/all', {
      params: {
        query: { active: options?.active, page, limit },
      },
    })

    if (fetchResponse.data?.content) {
      return {
        ok: true,
        data: fetchResponse.data as PaginatedResponse<RentalBlockWithRentalObject>,
      }
    }

    throw new Error(
      `Unexpected response status: ${fetchResponse.response.status}`
    )
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getAllRentalBlocks')
    return { ok: false, err: 'unknown' }
  }
}

export async function searchRentalBlocks(
  options: SearchRentalBlocksOptions
): Promise<
  AdapterResult<PaginatedResponse<RentalBlockWithRentalObject>, 'unknown'>
> {
  try {
    const {
      q,
      fields,
      kategori,
      distrikt,
      blockReason,
      fastighet,
      fromDateGte,
      toDateLte,
      active,
      page = 1,
      limit = 50,
    } = options

    const fetchResponse = await client().GET(
      '/residences/rental-blocks/search',
      {
        params: {
          query: {
            q,
            fields,
            kategori: toArray(kategori) as
              | ('Bostad' | 'Bilplats' | 'Lokal' | 'Förråd' | 'Övrigt')[]
              | undefined,
            distrikt: toArray(distrikt),
            blockReason: toArray(blockReason),
            fastighet: toArray(fastighet),
            fromDateGte,
            toDateLte,
            active,
            page,
            limit,
          },
        },
      }
    )

    if (fetchResponse.data?.content) {
      return {
        ok: true,
        data: fetchResponse.data as PaginatedResponse<RentalBlockWithRentalObject>,
      }
    }

    throw new Error(
      `Unexpected response status: ${fetchResponse.response.status}`
    )
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.searchRentalBlocks')
    return { ok: false, err: 'unknown' }
  }
}

export async function exportRentalBlocksToExcel(
  options: RentalBlocksFilterOptions
): Promise<AdapterResult<ArrayBuffer, 'unknown'>> {
  try {
    // Build URLSearchParams to properly handle arrays (repeated params)
    const params = new URLSearchParams()
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          // For arrays, append each value with the same key
          value.forEach((v) => params.append(key, v))
        } else {
          params.append(key, String(value))
        }
      }
    })

    const response = await axios.get(
      `${config.propertyBaseService.url}/residences/rental-blocks/export`,
      {
        params,
        responseType: 'arraybuffer',
      }
    )

    return { ok: true, data: response.data }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.exportRentalBlocksToExcel')
    return { ok: false, err: 'unknown' }
  }
}

type BlockReason = { id: string; caption: string }

export async function getBlockReasons(): Promise<
  AdapterResult<BlockReason[], 'unknown'>
> {
  try {
    const response = await axios.get(
      `${config.propertyBaseService.url}/residences/block-reasons`
    )

    if (response.data?.content) {
      return { ok: true, data: response.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getBlockReasons')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENTS ====================

export {
  // Component Categories
  getComponentCategories,
  getComponentCategoryById,
  createComponentCategory,
  updateComponentCategory,
  deleteComponentCategory,
  // Component Types
  getComponentTypes,
  getComponentTypeById,
  createComponentType,
  updateComponentType,
  deleteComponentType,
  // Component Subtypes
  getComponentSubtypes,
  getComponentSubtypeById,
  createComponentSubtype,
  updateComponentSubtype,
  deleteComponentSubtype,
  // Component Models
  getComponentModels,
  getComponentModelById,
  findModelByExactName,
  createComponentModel,
  updateComponentModel,
  deleteComponentModel,
  // Components
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  // Component Installations
  getComponentInstallations,
  getComponentInstallationById,
  createComponentInstallation,
  updateComponentInstallation,
  deleteComponentInstallation,
  // Components by Room
  getComponentsByRoomId,
  // Component File Uploads
  uploadComponentFile,
  getComponentFiles,
  deleteComponentFile,
  // Component Model Documents
  uploadComponentModelDocument,
  getComponentModelDocuments,
  deleteComponentModelDocument,
  // Document Metadata
  createDocument,
  // AI Analysis
  analyzeComponentImage,
} from './components'
