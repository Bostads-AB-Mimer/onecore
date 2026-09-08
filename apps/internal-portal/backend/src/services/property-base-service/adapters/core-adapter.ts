import { AxiosError } from 'axios'
import { property } from '@onecore/types'

import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'
import { AdapterResult } from '@/services/types'

const coreBaseUrl = Config.core.url

type MarketArea = property.MarketArea

// Only the field the BFF composition helper needs from PropertyDetails —
// deliberately not a full mirror of the core response shape.
type PropertyDetailsMarketArea = {
  marketArea: MarketArea | null
}

const getPropertyDetails = async (
  propertyCode: string
): Promise<
  AdapterResult<PropertyDetailsMarketArea, 'not-found' | 'unknown'>
> => {
  try {
    const response = await getFromCore<{ content: PropertyDetailsMarketArea }>({
      method: 'get',
      url: `${coreBaseUrl}/properties/${propertyCode}`,
    })
    return { ok: true, data: response.data.content }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      return { ok: false, err: 'not-found', statusCode: 404 }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const listMarketAreas = async (): Promise<
  AdapterResult<MarketArea[], 'unknown'>
> => {
  try {
    const response = await getFromCore<{ content: MarketArea[] }>({
      method: 'get',
      url: `${coreBaseUrl}/market-areas`,
    })
    return { ok: true, data: response.data.content }
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export { getPropertyDetails, listMarketAreas }
