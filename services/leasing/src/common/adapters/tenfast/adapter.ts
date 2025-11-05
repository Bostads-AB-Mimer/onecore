import axios from 'axios'
import { logger } from '@onecore/utilities'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastTenant,
} from './schemas'
import config from '../../config'
import { AdapterResult } from '../../../services/lease-service/adapters/types'

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey

const axiosOptions = {
  headers: {
    'Content-type': 'application/json',
    'api-token': apiKey,
  },
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await axios.get(
      `${baseUrl}/v1/hyresvard/hyresgaster?filter[externalId]=${contactCode}`,
      axiosOptions
    )
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedTenantResponse =
      TenfastTenantByContactCodeResponseSchema.safeParse(tenantResponse.data)
    if (!parsedTenantResponse.success) {
      throw new Error(
        'Failed to parse Tenfast response',
        parsedTenantResponse.error
      )
    }

    return {
      ok: true,
      data: parsedTenantResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}
