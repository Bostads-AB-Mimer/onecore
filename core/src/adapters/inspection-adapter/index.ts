import createClient from 'openapi-fetch'
import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'

export type XpandInspection = components['schemas']['XpandInspection']

const client = () =>
  createClient<paths>({
    baseUrl: config.inspectionService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

export const getXpandInspections = async ({
  skip = 0,
  limit = 100,
  sortAscending,
}: { skip?: number; limit?: number; sortAscending?: boolean } = {}): Promise<
  AdapterResult<XpandInspection[], 'unknown'>
> => {
  try {
    const fetchResponse = await client().GET('/inspections/xpand', {
      params: {
        query: { skip, limit, sortAscending },
      },
    })

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.inspections) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data?.content.inspections,
    }
  } catch (error) {
    logger.error({ error }, 'inspection-adapter.getXpandInspections')

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandInspectionsByResidenceId = async (
  residenceId: string
): Promise<AdapterResult<XpandInspection[], 'unknown' | 'not-found'>> => {
  try {
    const fetchResponse = await client().GET(
      '/inspections/xpand/residence/{residenceId}',
      {
        params: { path: { residenceId: residenceId } },
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
