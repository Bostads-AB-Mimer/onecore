import { loggedAxios as axios, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'
import { mapLeasingResponse } from './map-leasing-response'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

// Error codes:
//   'bad-request'    leasing rejected the request body (400)
//   'not-found'      no text content for the market area (404)
//   'conflict'       text content already exists for the market area (409)
//   'request-failed' leasing answered with an unexpected status, or the
//                    request itself failed (5xx, network error)

type ListingAreaTextContent = z.infer<
  typeof leasing.v1.ListingAreaTextContentSchema
>
type CreateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingAreaTextContentRequestSchema
>
type UpdateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingAreaTextContentRequestSchema
>

const listListingAreaTextContent = async (): Promise<
  AdapterResult<ListingAreaTextContent[], 'request-failed'>
> => {
  try {
    const response = await axios.get<{
      content: ListingAreaTextContent[]
    }>(`${tenantsLeasesServiceUrl}/listing-area-text-content`)

    return mapLeasingResponse(response, 200, {}, (body) => body.content)
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.listListingAreaTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

const getListingAreaTextContentByMarketAreaCode = async (
  marketAreaCode: string
): Promise<
  AdapterResult<ListingAreaTextContent, 'not-found' | 'request-failed'>
> => {
  try {
    const response = await axios.get<{
      content: ListingAreaTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`
    )

    return mapLeasingResponse(
      response,
      200,
      { 404: 'not-found' },
      (body) => body.content
    )
  } catch (err) {
    logger.error(
      { err },
      'leasing-adapter.getListingAreaTextContentByMarketAreaCode'
    )
    return { ok: false, err: 'request-failed' }
  }
}

const createListingAreaTextContent = async (
  data: CreateListingAreaTextContentRequest
): Promise<
  AdapterResult<
    ListingAreaTextContent,
    'bad-request' | 'conflict' | 'request-failed'
  >
> => {
  try {
    const response = await axios.post<{
      content: ListingAreaTextContent
    }>(`${tenantsLeasesServiceUrl}/listing-area-text-content`, data)

    return mapLeasingResponse(
      response,
      201,
      { 400: 'bad-request', 409: 'conflict' },
      (body) => body.content
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.createListingAreaTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

const updateListingAreaTextContent = async (
  marketAreaCode: string,
  data: UpdateListingAreaTextContentRequest
): Promise<
  AdapterResult<
    ListingAreaTextContent,
    'bad-request' | 'not-found' | 'request-failed'
  >
> => {
  try {
    const response = await axios.put<{
      content: ListingAreaTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`,
      data
    )

    return mapLeasingResponse(
      response,
      200,
      { 400: 'bad-request', 404: 'not-found' },
      (body) => body.content
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.updateListingAreaTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

const deleteListingAreaTextContent = async (
  marketAreaCode: string
): Promise<AdapterResult<void, 'not-found' | 'request-failed'>> => {
  try {
    const response = await axios.delete(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`
    )

    return mapLeasingResponse(
      response,
      200,
      { 404: 'not-found' },
      () => undefined
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.deleteListingAreaTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

export {
  listListingAreaTextContent,
  getListingAreaTextContentByMarketAreaCode,
  createListingAreaTextContent,
  updateListingAreaTextContent,
  deleteListingAreaTextContent,
}
