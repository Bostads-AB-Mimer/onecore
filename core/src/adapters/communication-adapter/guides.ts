import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AdapterResult } from '../types'
import {
  client,
  CommonErr,
  fail,
  mapFetchError,
  ok,
  ProxiedAdapterResult,
  upstreamError,
} from './helpers'

// Responses are parsed through the shared zod schemas so date strings become
// Date objects and the adapter's return types match @onecore/types.

export const listGuides = async (query: {
  includeDrafts: boolean
}): Promise<AdapterResult<guides.GuideSummary[], CommonErr>> => {
  try {
    const { data, error, response } = await client().GET('/guides', {
      params: {
        query: { includeDrafts: query.includeDrafts ? 'true' : 'false' },
      },
    })
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.GuideSummarySchema.array().parse(data))
  } catch (err) {
    logger.error({ err }, 'communication-adapter: GET /guides failed')
    return fail('unknown')
  }
}

export const listCategories = async (): Promise<
  AdapterResult<guides.GuideCategory[], CommonErr>
> => {
  try {
    const { data, error, response } = await client().GET('/guides/categories')
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.GuideCategorySchema.array().parse(data))
  } catch (err) {
    logger.error(
      { err },
      'communication-adapter: GET /guides/categories failed'
    )
    return fail('unknown')
  }
}

export const getGuideBySlug = async (
  slug: string
): Promise<AdapterResult<guides.Guide, CommonErr>> => {
  try {
    const { data, error, response } = await client().GET(
      '/guides/by-slug/{slug}',
      { params: { path: { slug } } }
    )
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.GuideSchema.parse(data))
  } catch (err) {
    logger.error(
      { err, slug },
      'communication-adapter: GET /guides/by-slug/{slug} failed'
    )
    return fail('unknown')
  }
}

export const getGuideById = async (
  id: string
): Promise<AdapterResult<guides.Guide, CommonErr>> => {
  try {
    const { data, error, response } = await client().GET('/guides/{id}', {
      params: { path: { id } },
    })
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.GuideSchema.parse(data))
  } catch (err) {
    logger.error({ err, id }, 'communication-adapter: GET /guides/{id} failed')
    return fail('unknown')
  }
}

export const createGuide = async (
  body: guides.ServiceGuideWrite
): Promise<ProxiedAdapterResult<guides.Guide, CommonErr>> => {
  try {
    const { data, error, response } = await client().POST('/guides', {
      body,
    })
    if (error || !response.ok)
      return fail(mapFetchError(response), upstreamError(error))
    return ok(guides.GuideSchema.parse(data))
  } catch (err) {
    logger.error({ err }, 'communication-adapter: POST /guides failed')
    return fail('unknown')
  }
}

export const updateGuide = async (
  id: string,
  body: guides.ServiceGuideWrite
): Promise<ProxiedAdapterResult<guides.UpdateGuideResponse, CommonErr>> => {
  try {
    const { data, error, response } = await client().PUT('/guides/{id}', {
      params: { path: { id } },
      body,
    })
    if (error || !response.ok)
      return fail(mapFetchError(response), upstreamError(error))
    return ok(guides.UpdateGuideResponseSchema.parse(data))
  } catch (err) {
    logger.error({ err, id }, 'communication-adapter: PUT /guides/{id} failed')
    return fail('unknown')
  }
}

export const deleteGuide = async (
  id: string
): Promise<AdapterResult<guides.DeleteGuideResponse, CommonErr>> => {
  try {
    const { data, error, response } = await client().DELETE('/guides/{id}', {
      params: { path: { id } },
    })
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.DeleteGuideResponseSchema.parse(data))
  } catch (err) {
    logger.error(
      { err, id },
      'communication-adapter: DELETE /guides/{id} failed'
    )
    return fail('unknown')
  }
}

export const createStepImage = async (
  guideId: string,
  stepId: string,
  body: guides.CreateStepImageRequest
): Promise<ProxiedAdapterResult<guides.GuideStepImage, CommonErr>> => {
  try {
    const { data, error, response } = await client().POST(
      '/guides/{id}/steps/{stepId}/images',
      { params: { path: { id: guideId, stepId } }, body }
    )
    if (error || !response.ok)
      return fail(mapFetchError(response), upstreamError(error))
    return ok(guides.GuideStepImageSchema.parse(data))
  } catch (err) {
    logger.error(
      { err, guideId, stepId },
      'communication-adapter: POST /guides/{id}/steps/{stepId}/images failed'
    )
    return fail('unknown')
  }
}

export const deleteStepImage = async (
  guideId: string,
  imageId: string
): Promise<AdapterResult<guides.DeleteStepImageResponse, CommonErr>> => {
  try {
    const { data, error, response } = await client().DELETE(
      '/guides/{id}/images/{imageId}',
      { params: { path: { id: guideId, imageId } } }
    )
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(guides.DeleteStepImageResponseSchema.parse(data))
  } catch (err) {
    logger.error(
      { err, guideId, imageId },
      'communication-adapter: DELETE /guides/{id}/images/{imageId} failed'
    )
    return fail('unknown')
  }
}
