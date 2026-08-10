import { z } from 'zod'
import {
  AudienceCriterionSchema,
  CancelDispatchResponseSchema,
  ChannelSchema,
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
  RecipientStatusSchema,
  RescheduleDispatchResponseSchema,
  TemplateSchema,
} from './schema'

export type Direction = z.infer<typeof DirectionSchema>
export type Channel = z.infer<typeof ChannelSchema>
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>

export type Dispatch = z.infer<typeof DispatchSchema>
export type MessageRecipient = z.infer<typeof MessageRecipientSchema>
export type DispatchAttachment = z.infer<typeof DispatchAttachmentSchema>
export type Template = z.infer<typeof TemplateSchema>

export type LogOutboundRecipient = z.infer<typeof LogOutboundRecipientSchema>
export type LogOutboundParams = z.infer<typeof LogOutboundParamsSchema>

export type DispatchWithRecipients = z.infer<
  typeof DispatchWithRecipientsSchema
>
export type CustomerMessage = z.infer<typeof CustomerMessageSchema>

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
