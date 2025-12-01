import axios from 'axios'
import config from '../../config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoicesByOcrResponseSchema,
  TenfastInvoice,
  TenfastInvoiceRow,
} from './schemas'

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

export const getInvoicesForTenant = async (
  tenantId: string
): Promise<AdapterResult<TenfastInvoice[], string>> => {
  try {
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/hyresgaster/${tenantId}/hyror`,
      axiosOptions
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByTenantIdResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return { ok: true, data: parsedResponse.data }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<TenfastInvoice | null, string>> => {
  try {
    console.log('ocr', ocr)
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/hyror?filter[ocrNumber]=${ocr}`,
      axiosOptions
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return { ok: true, data: parsedResponse.data.records[0] ?? null }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoiceArticle = async (
  articleId: string
): Promise<AdapterResult<TenfastInvoiceRow[], string>> => {
  try {
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/articles/${articleId}`,
      axiosOptions
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    return { ok: true, data: result.data.hyror }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoicesNotExported = async (maxCount: number) => {
  // Dummy implementation awaiting exported flag in Tenfast
  return await getInvoicesForTenant('67eb3cdbc334e091aa28f2fe')
}

export const convertToDate = (tenfastDate: string) => {
  return new Date(tenfastDate)
}
