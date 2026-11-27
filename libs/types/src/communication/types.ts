import { z } from 'zod'
import {
  AudienceCriterionSchema,
  CancelDispatchResponseSchema,
  ChannelSchema,
  CreateTemplateParamsSchema,
  CreateTemplateSchema,
  CreateReleaseNoteParamsSchema,
  CreateReleaseNoteSchema,
  CustomerMessageSchema,
  DirectionSchema,
  DispatchAttachmentSchema,
  DispatchListItemSchema,
  DispatchSchema,
  DispatchSearchQueryParamsSchema,
  DispatchStatusSchema,
  DispatchWithRecipientsSchema,
  LogOutboundParamsSchema,
  LogOutboundRecipientSchema,
  MessageRecipientSchema,
  PlaceholderKindSchema,
  PreviewSystemTemplateSchema,
  PreviewTemplateSchema,
  RecipientStatusSchema,
  ReleaseNoteAppSchema,
  ReleaseNoteCategorySchema,
  ReleaseNoteSchema,
  RescheduleDispatchResponseSchema,
  ScheduleConfigSchema,
  SystemTemplateKeySchema,
  SystemTemplatePreviewSchema,
  SystemTemplateSchema,
  TemplatePlaceholderSchema,
  TemplatePreviewSchema,
  TemplateSchema,
  TemplateStatusFilterSchema,
  UpdateReleaseNoteSchema,
  UpdateSystemTemplateParamsSchema,
  UpdateSystemTemplateSchema,
  UpdateTemplateParamsSchema,
  UpdateTemplateSchema,
} from './schema'

export type Direction = z.infer<typeof DirectionSchema>
export type Channel = z.infer<typeof ChannelSchema>
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>

export type Dispatch = z.infer<typeof DispatchSchema>
export type MessageRecipient = z.infer<typeof MessageRecipientSchema>
export type DispatchAttachment = z.infer<typeof DispatchAttachmentSchema>
export type Template = z.infer<typeof TemplateSchema>
export type CreateTemplate = z.infer<typeof CreateTemplateSchema>
export type UpdateTemplate = z.infer<typeof UpdateTemplateSchema>
export type TemplateStatusFilter = z.infer<typeof TemplateStatusFilterSchema>
export type CreateTemplateParams = z.infer<typeof CreateTemplateParamsSchema>
export type UpdateTemplateParams = z.infer<typeof UpdateTemplateParamsSchema>
export type PreviewTemplate = z.infer<typeof PreviewTemplateSchema>
export type TemplatePreview = z.infer<typeof TemplatePreviewSchema>

export type SystemTemplateKey = z.infer<typeof SystemTemplateKeySchema>
export type PlaceholderKind = z.infer<typeof PlaceholderKindSchema>
export type TemplatePlaceholder = z.infer<typeof TemplatePlaceholderSchema>
export type SystemTemplate = z.infer<typeof SystemTemplateSchema>
export type UpdateSystemTemplate = z.infer<typeof UpdateSystemTemplateSchema>
export type UpdateSystemTemplateParams = z.infer<
  typeof UpdateSystemTemplateParamsSchema
>
export type PreviewSystemTemplate = z.infer<typeof PreviewSystemTemplateSchema>
export type SystemTemplatePreview = z.infer<typeof SystemTemplatePreviewSchema>

export type LogOutboundRecipient = z.infer<typeof LogOutboundRecipientSchema>
export type LogOutboundParams = z.infer<typeof LogOutboundParamsSchema>

export type DispatchWithRecipients = z.infer<
  typeof DispatchWithRecipientsSchema
>
export type CustomerMessage = z.infer<typeof CustomerMessageSchema>

export type ReleaseNoteCategory = z.infer<typeof ReleaseNoteCategorySchema>
export type ReleaseNoteApp = z.infer<typeof ReleaseNoteAppSchema>
export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>
export type CreateReleaseNote = z.infer<typeof CreateReleaseNoteSchema>
export type UpdateReleaseNote = z.infer<typeof UpdateReleaseNoteSchema>
export type CreateReleaseNoteParams = z.infer<
  typeof CreateReleaseNoteParamsSchema
>

export type DispatchStatus = z.infer<typeof DispatchStatusSchema>
export type AudienceCriterion = z.infer<typeof AudienceCriterionSchema>
export type DispatchSearchQueryParams = z.infer<
  typeof DispatchSearchQueryParamsSchema
>
export type DispatchListItem = z.infer<typeof DispatchListItemSchema>

export type CancelDispatchResponse = z.infer<
  typeof CancelDispatchResponseSchema
>
export type RescheduleDispatchResponse = z.infer<
  typeof RescheduleDispatchResponseSchema
>
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>
