import { loggedAxios as axios, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'

// The response.status === 400/404/409 branches below rely on
// axios.defaults.validateStatus being set process-wide in
// leasing-adapter/index.ts (status < 500 resolves instead of throwing), so
// this file must be imported via the leasing-adapter folder index for that
// side effect to run.

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

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'request-failed' }
  } catch (err) {
    logger.error(
      { err },
      'leasing-adapter.getListingTextContentByRentalObjectCode'
    )
    return { ok: false, err: 'request-failed' }
  }
}

const getListingTextContentExistence = async (
  rentalObjectCodes: string[]
): Promise<AdapterResult<string[], 'bad-request' | 'request-failed'>> => {
  try {
    const response = await axios.post<{
      content: string[]
    }>(`${tenantsLeasesServiceUrl}/listing-text-content/existence`, {
      rentalObjectCodes,
    })

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 400) {
      return { ok: false, err: 'bad-request' }
    }

    return { ok: false, err: 'request-failed' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getListingTextContentExistence')
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

    if (response.status === 201) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 400) {
      return { ok: false, err: 'bad-request' }
    }

    if (response.status === 409) {
      return { ok: false, err: 'conflict' }
    }

    return { ok: false, err: 'request-failed' }
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

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 400) {
      return { ok: false, err: 'bad-request' }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'request-failed' }
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

    if (response.status === 200) {
      return { ok: true, data: undefined }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'request-failed' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.deleteListingTextContent')
    return { ok: false, err: 'request-failed' }
  }
}

export {
  getListingTextContentByRentalObjectCode,
  getListingTextContentExistence,
  createListingTextContent,
  updateListingTextContent,
  deleteListingTextContent,
}
