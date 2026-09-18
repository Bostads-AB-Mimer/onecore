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

type MarketArea = components['schemas']['MarketArea']

export async function listMarketAreas(): Promise<
  AdapterResult<MarketArea[], 'unknown'>
> {
  try {
    const response = await client().GET('/market-areas')

    if (response.data?.content) {
      return { ok: true, data: response.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.listMarketAreas')
    return { ok: false, err: 'unknown' }
  }
}
