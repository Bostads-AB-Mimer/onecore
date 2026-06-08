import { z } from 'zod'
import {
  ChannelSchema,
  DirectionSchema,
  DispatchAttachmentSchema,
  DispatchSchema,
  LogOutboundParamsSchema,
  LogOutboundRecipientSchema,
  MessageRecipientSchema,
  RecipientStatusSchema,
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
