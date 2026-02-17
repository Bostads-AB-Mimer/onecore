import createClient from 'openapi-fetch'
import { logger, PaginatedResponse } from '@onecore/utilities'
import config from '../../common/config'
import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'
import { InspectionStatusFilter } from '../../services/inspection-service/schemas'

export type XpandInspection = components['schemas']['XpandInspection']
export type DetailedXpandInspection =
  components['schemas']['DetailedXpandInspection']

const client = () =>
  createClient<paths>({
    baseUrl: config.inspectionService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

export const getXpandInspections = async ({
  page = 1,
  limit = 25,
  statusFilter,
  sortAscending,
  inspector,
  address,
}: {
  page?: number
  limit?: number
  statusFilter?: InspectionStatusFilter
  sortAscending?: boolean
  inspector?: string
  address?: string
} = {}): Promise<
  AdapterResult<PaginatedResponse<XpandInspection>, 'unknown'>
> => {
  try {
    const fetchResponse = await client().GET('/inspections/xpand', {
      params: {
        query: { page, limit, statusFilter, sortAscending, inspector, address },
      },
    })

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: {
        content: fetchResponse.data.content,
        _meta: fetchResponse.data
          ._meta as PaginatedResponse<XpandInspection>['_meta'],
        _links: fetchResponse.data
          ._links as PaginatedResponse<XpandInspection>['_links'],
      },
    }
  } catch (error) {
    logger.error({ error }, 'inspection-adapter.getXpandInspections')

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandInspectionsByResidenceId = async (
  residenceId: string,
  statusFilter?: InspectionStatusFilter
): Promise<AdapterResult<XpandInspection[], 'unknown' | 'not-found'>> => {
  try {
    const fetchResponse = await client().GET(
      '/inspections/xpand/residence/{residenceId}',
      {
        params: {
          path: { residenceId },
          query: { statusFilter },
        },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.inspections) {
      return { ok: false, err: 'not-found' }
    }

    return {
      ok: true,
      data: fetchResponse.data?.content.inspections,
    }
  } catch (error) {
    logger.error(
      { error, residenceId },
      'inspection-adapter.getXpandInspectionsByResidenceId'
    )

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandInspectionById = async (
  inspectionId: string
): Promise<AdapterResult<DetailedXpandInspection, 'unknown' | 'not-found'>> => {
  try {
    const fetchResponse = await client().GET(
      '/inspections/xpand/{inspectionId}',
      {
        params: { path: { inspectionId: inspectionId } },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.inspection) {
      return { ok: false, err: 'not-found' }
    }

    return {
      ok: true,
      data: fetchResponse.data?.content.inspection,
    }
  } catch (error) {
    logger.error(
      { error, inspectionId },
      'inspection-adapter.getXpandInspectionById'
    )

    return { ok: false, err: 'unknown' }
  }
}

export const createInspection = async (
  body: components['schemas']['CreateInspection']
): Promise<AdapterResult<DetailedXpandInspection, string>> => {
  try {
    const fetchResponse = await client().POST('/inspections', {
      body,
    })

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.inspection) {
      return { ok: false, err: 'Failed to create inspection' }
    }

    return {
      ok: true,
      data: fetchResponse.data.content.inspection,
    }
  } catch (error) {
    logger.error({ error }, 'inspection-adapter.createInspection')
    return { ok: false, err: 'Failed to create inspection' }
  }
}
