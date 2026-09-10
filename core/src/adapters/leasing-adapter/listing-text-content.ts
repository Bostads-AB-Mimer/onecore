import { loggedAxios as axios, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'
import { mapLeasingResponse } from './map-leasing-response'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type CreateListingTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingTextContentRequestSchema
>
type UpdateListingTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingTextContentRequestSchema
>

// Error codes:
//   'bad-request'    leasing rejected the request body (400)
//   'not-found'      no text content for the rental object (404)
//   'conflict'       text content already exists for the rental object (409)
//   'request-failed' leasing answered with an unexpected status, or the
//                    request itself failed (5xx, network error)

const getListingTextContentByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<ListingTextContent, 'not-found' | 'request-failed'>
> => {
  try {
    const response = await axios.get<{
      content: ListingTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-text-content/${encodeURIComponent(rentalObjectCode)}`
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
      'leasing-adapter.getListingTextContentByRentalObjectCode'
    )
    return { ok: false, err: 'request-failed' }
  }
}

const createListingTextContent = async (
  data: CreateListingTextContentRequest
): Promise<
  AdapterResult<
    ListingTextContent,
    'bad-request' | 'conflict' | 'request-failed'
  >
> => {
  try {
    const response = await axios.post<{
      content: ListingTextContent
    }>(`${tenantsLeasesServiceUrl}/listing-text-content`, data)

    return mapLeasingResponse(
      response,
      201,
      { 400: 'bad-request', 409: 'conflict' },
      (body) => body.content
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.createListingTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

const updateListingTextContent = async (
  rentalObjectCode: string,
  data: UpdateListingTextContentRequest
): Promise<
  AdapterResult<
    ListingTextContent,
    'bad-request' | 'not-found' | 'request-failed'
  >
> => {
  try {
    const response = await axios.put<{
      content: ListingTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-text-content/${encodeURIComponent(rentalObjectCode)}`,
      data
    )

    return mapLeasingResponse(
      response,
      200,
      { 400: 'bad-request', 404: 'not-found' },
      (body) => body.content
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.updateListingTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

const deleteListingTextContent = async (
  rentalObjectCode: string
): Promise<AdapterResult<void, 'not-found' | 'request-failed'>> => {
  try {
    const response = await axios.delete(
      `${tenantsLeasesServiceUrl}/listing-text-content/${encodeURIComponent(rentalObjectCode)}`
    )

    return mapLeasingResponse(
      response,
      200,
      { 404: 'not-found' },
      () => undefined
    )
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.deleteListingTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

export {
  getListingTextContentByRentalObjectCode,
  createListingTextContent,
  updateListingTextContent,
  deleteListingTextContent,
}
