import { z } from 'zod'

import {
  CalloutTypeSchema,
  CategoryInputSchema,
  CreateGuideRequestSchema,
  CreateStepImageRequestSchema,
  CreateStepImageResponseSchema,
  DeleteGuideResponseSchema,
  DeleteStepImageResponseSchema,
  GuideCategorySchema,
  GuideImageDeleteResponseSchema,
  GuideImageUploadRequestSchema,
  GuideImageUploadResponseSchema,
  GuideSchema,
  GuideStatusSchema,
  GuideStepImageSchema,
  GuideStepImageWithUrlSchema,
  GuideStepSchema,
  GuideStepWithUrlsSchema,
  GuideSummarySchema,
  GuideWithUrlsSchema,
  ListGuidesQuerySchema,
  ServiceGuideUpdateSchema,
  ServiceGuideWriteSchema,
  StepImageInputSchema,
  StepInputSchema,
  UnpublishedGuideSchema,
  UpdateGuideRequestSchema,
  UpdateGuideResponseSchema,
} from './schema'

export type GuideStatus = z.infer<typeof GuideStatusSchema>
export type CalloutType = z.infer<typeof CalloutTypeSchema>

export type GuideCategory = z.infer<typeof GuideCategorySchema>
export type GuideStepImage = z.infer<typeof GuideStepImageSchema>
export type GuideStepImageWithUrl = z.infer<typeof GuideStepImageWithUrlSchema>
export type GuideStep = z.infer<typeof GuideStepSchema>
export type GuideStepWithUrls = z.infer<typeof GuideStepWithUrlsSchema>
export type GuideSummary = z.infer<typeof GuideSummarySchema>
export type Guide = z.infer<typeof GuideSchema>
export type GuideWithUrls = z.infer<typeof GuideWithUrlsSchema>
export type UnpublishedGuide = z.infer<typeof UnpublishedGuideSchema>

export type StepImageInput = z.infer<typeof StepImageInputSchema>
export type StepInput = z.infer<typeof StepInputSchema>
export type CategoryInput = z.infer<typeof CategoryInputSchema>
export type CreateGuideRequest = z.infer<typeof CreateGuideRequestSchema>
export type UpdateGuideRequest = z.infer<typeof UpdateGuideRequestSchema>
export type ServiceGuideWrite = z.infer<typeof ServiceGuideWriteSchema>
export type ServiceGuideUpdate = z.infer<typeof ServiceGuideUpdateSchema>
export type ListGuidesQuery = z.infer<typeof ListGuidesQuerySchema>
export type CreateStepImageRequest = z.infer<
  typeof CreateStepImageRequestSchema
>
export type GuideImageUploadRequest = z.infer<
  typeof GuideImageUploadRequestSchema
>
export type UpdateGuideResponse = z.infer<typeof UpdateGuideResponseSchema>
export type DeleteGuideResponse = z.infer<typeof DeleteGuideResponseSchema>
export type DeleteStepImageResponse = z.infer<
  typeof DeleteStepImageResponseSchema
>
export type CreateStepImageResponse = z.infer<
  typeof CreateStepImageResponseSchema
>
export type GuideImageUploadResponse = z.infer<
  typeof GuideImageUploadResponseSchema
>
export type GuideImageDeleteResponse = z.infer<
  typeof GuideImageDeleteResponseSchema
>
