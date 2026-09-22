import axios from 'axios'

import { coreApiBaseUrl, DELETE, GET, POST, PUT } from './baseApi'
import { components } from './generated/api-types'

export type GuideSummary = components['schemas']['GuideSummary']
export type GuideCategory = components['schemas']['GuideCategory']
export type GuideWithUrls = components['schemas']['GuideWithUrls']
export type GuideStepWithUrls = GuideWithUrls['steps'][number]
export type GuideStepImageWithUrl =
  components['schemas']['GuideStepImageWithUrl']
export type UnpublishedGuide = components['schemas']['UnpublishedGuide']
export type CreateGuideRequest = components['schemas']['CreateGuideRequest']
export type UpdateGuideRequest = components['schemas']['UpdateGuideRequest']
export type GuideImageUploadRequest =
  components['schemas']['GuideImageUploadRequest']
export type GuideBySlugResponse = GuideWithUrls | UnpublishedGuide

export const isUnpublishedGuide = (
  guide: GuideBySlugResponse
): guide is UnpublishedGuide => 'unpublished' in guide && guide.unpublished

export const guideService = {
  async getGuides(params: { includeDrafts: boolean }): Promise<GuideSummary[]> {
    const response = await GET('/guides', {
      params: { query: { includeDrafts: params.includeDrafts } },
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async getGuideBySlug(slug: string): Promise<GuideBySlugResponse> {
    const response = await GET('/guides/by-slug/{slug}', {
      params: { path: { slug } },
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async getGuideById(id: string): Promise<GuideWithUrls> {
    const response = await GET('/guides/{id}', {
      params: { path: { id } },
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async getCategories(): Promise<GuideCategory[]> {
    const response = await GET('/guides/categories')
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async createGuide(body: CreateGuideRequest): Promise<GuideWithUrls> {
    const response = await POST('/guides', { body })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async updateGuide(
    id: string,
    body: UpdateGuideRequest
  ): Promise<GuideWithUrls> {
    const response = await PUT('/guides/{id}', {
      params: { path: { id } },
      body,
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')
    return response.data.content
  },

  async deleteGuide(id: string): Promise<void> {
    const response = await DELETE('/guides/{id}', {
      params: { path: { id } },
    })
    if (response.error) throw response.error
  },

  async deleteStepImage(guideId: string, imageId: string): Promise<void> {
    const response = await DELETE('/guides/{id}/images/{imageId}', {
      params: { path: { id: guideId, imageId } },
    })
    if (response.error) throw response.error
  },

  // openapi-fetch cannot report upload progress, so this one call goes
  // through axios against the same base url and cookie session.
  async uploadStepImage(
    guideId: string,
    stepId: string,
    body: GuideImageUploadRequest,
    onProgress?: (fraction: number) => void
  ): Promise<GuideStepImageWithUrl> {
    const response = await axios.post<{ content: GuideStepImageWithUrl }>(
      `${coreApiBaseUrl}/guides/${encodeURIComponent(guideId)}/steps/${encodeURIComponent(stepId)}/images`,
      body,
      {
        withCredentials: true,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(event.loaded / event.total)
          }
        },
      }
    )
    return response.data.content
  },
}
