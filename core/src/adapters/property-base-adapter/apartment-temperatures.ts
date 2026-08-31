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

// ==================== APARTMENT TEMPERATURES (EcoGuard Curves) ====================

export async function getApartmentTemperatures(
  objectNumber: string,
  query: { from?: number; to?: number; interval?: 'H' | 'D' }
): Promise<
  AdapterResult<
    components['schemas']['ApartmentTemperaturesResponse'],
    'not-found' | 'unknown'
  >
> {
  try {
    const response = await client().GET(
      '/apartments/{objectNumber}/temperatures',
      {
        params: { path: { objectNumber }, query },
      }
    )

    if (response.data?.content) {
      return { ok: true, data: response.data.content }
    }
    if (response.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, '@onecore/property-adapter.getApartmentTemperatures')
    return { ok: false, err: 'unknown' }
  }
}
