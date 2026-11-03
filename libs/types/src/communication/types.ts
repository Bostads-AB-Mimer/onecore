import { z } from 'zod'
import {
  ChannelSchema,
  CreateReleaseNoteParamsSchema,
  CreateReleaseNoteSchema,
  CustomerMessageSchema,
  DirectionSchema,
  DispatchAttachmentSchema,
  DispatchSchema,
  DispatchWithRecipientsSchema,
  LogOutboundParamsSchema,
  LogOutboundRecipientSchema,
  MessageRecipientSchema,
  RecipientStatusSchema,
  ReleaseNoteAppSchema,
  ReleaseNoteCategorySchema,
  ReleaseNoteSchema,
  TemplateSchema,
  UpdateReleaseNoteSchema,
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

export type ReleaseNoteCategory = z.infer<typeof ReleaseNoteCategorySchema>
export type ReleaseNoteApp = z.infer<typeof ReleaseNoteAppSchema>
export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>
export type CreateReleaseNote = z.infer<typeof CreateReleaseNoteSchema>
export type UpdateReleaseNote = z.infer<typeof UpdateReleaseNoteSchema>
export type CreateReleaseNoteParams = z.infer<
  typeof CreateReleaseNoteParamsSchema
>
