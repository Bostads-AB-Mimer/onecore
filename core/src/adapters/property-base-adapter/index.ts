import { logger } from 'onecore-utilities'
import createClient from 'openapi-fetch'

import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'

import config from '../../common/config'

const client = createClient<paths>({
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
    const response = await client.GET('/properties/search', {
      params: { query: { q } },
    })

    if (response.data) {
      return { ok: true, data: response.data.content ?? [] }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.searchProperties')
    return { ok: false, err: 'unknown' }
  }
}

type SearchBuildingsResponse = components['schemas']['Building'][]

export async function searchBuildings(
  q: string
): Promise<AdapterResult<SearchBuildingsResponse, 'unknown'>> {
  try {
    const response = await client.GET('/buildings/search', {
      params: { query: { q } },
    })

    if (response.data) {
      return { ok: true, data: response.data.content ?? [] }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.searchBuildings')
    return { ok: false, err: 'unknown' }
  }
}
