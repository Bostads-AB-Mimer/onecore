import { loggedAxios as axios, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'

// The response.status === 404/409 branches below rely on
// axios.defaults.validateStatus being set process-wide in
// leasing-adapter/index.ts (status < 500 resolves instead of throwing), so
// this file must be imported via the leasing-adapter folder index for that
// side effect to run.

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

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
  AdapterResult<ListingAreaTextContent[], 'unknown'>
> => {
  try {
    const response = await axios.get<{
      content: ListingAreaTextContent[]
    }>(`${tenantsLeasesServiceUrl}/listing-area-text-content`)

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.listListingAreaTextContent')
    return { ok: false, err: 'unknown' }
  }
}

const getListingAreaTextContentByMarketAreaCode = async (
  marketAreaCode: string
): Promise<AdapterResult<ListingAreaTextContent, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.get<{
      content: ListingAreaTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      { err },
      'leasing-adapter.getListingAreaTextContentByMarketAreaCode'
    )
    return { ok: false, err: 'unknown' }
  }
}

const createListingAreaTextContent = async (
  data: CreateListingAreaTextContentRequest
): Promise<AdapterResult<ListingAreaTextContent, 'conflict' | 'unknown'>> => {
  try {
    const response = await axios.post<{
      content: ListingAreaTextContent
    }>(`${tenantsLeasesServiceUrl}/listing-area-text-content`, data)

    if (response.status === 201) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 409) {
      return { ok: false, err: 'conflict' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.createListingAreaTextContent')
    return { ok: false, err: 'unknown' }
  }
}

const updateListingAreaTextContent = async (
  marketAreaCode: string,
  data: UpdateListingAreaTextContentRequest
): Promise<AdapterResult<ListingAreaTextContent, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.put<{
      content: ListingAreaTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`,
      data
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.updateListingAreaTextContent')
    return { ok: false, err: 'unknown' }
  }
}

const deleteListingAreaTextContent = async (
  marketAreaCode: string
): Promise<AdapterResult<void, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.delete(
      `${tenantsLeasesServiceUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`
    )

    if (response.status === 200) {
      return { ok: true, data: undefined }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.deleteListingAreaTextContent')
    return { ok: false, err: 'unknown' }
  }
}

export {
  listListingAreaTextContent,
  getListingAreaTextContentByMarketAreaCode,
  createListingAreaTextContent,
  updateListingAreaTextContent,
  deleteListingAreaTextContent,
}
