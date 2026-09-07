import { z } from 'zod'

export const DIRECTION = ['outbound', 'inbound'] as const
// 'my-pages' is a publication to the tenant portal rather than a provider send:
// there is no address and no delivery webhook, so recipients land as 'sent'
// with toAddress 'Mina sidor' (MIM-1957).
export const CHANNEL = ['sms', 'email', 'my-pages'] as const
export const RECIPIENT_STATUS = [
  'pending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'received',
] as const

export const DirectionSchema = z.enum(DIRECTION)
export const ChannelSchema = z.enum(CHANNEL)
export const RecipientStatusSchema = z.enum(RECIPIENT_STATUS)

export const DispatchSchema = z.object({
  id: z.string().uuid(),
  direction: DirectionSchema,
  channel: ChannelSchema,
  fromAddress: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  messageType: z.string(),
  provider: z.string(),
  triggeredByUser: z.string().nullable(),
  triggeredAt: z.coerce.date(),
  recipientCount: z.number().int().nonnegative(),
  audienceCriteria: z.string().nullable(),
  inReplyToDispatchId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
  // od-<odoo id> of the maintenance request this dispatch belongs to, when it
  // has one. Null for dispatches with no errand (bulk sends, parking offers).
  // The internal portal builds the Odoo deep link from this code alone.
  workOrderCode: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const MessageRecipientSchema = z.object({
  id: z.string().uuid(),
  dispatchId: z.string().uuid(),
  contactCode: z.string().nullable(),
  toAddress: z.string(),
  status: RecipientStatusSchema,
  statusUpdatedAt: z.coerce.date(),
  externalMessageId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const DispatchAttachmentSchema = z.object({
  id: z.string().uuid(),
  dispatchId: z.string().uuid(),
  storageKey: z.string(),
  filename: z.string(),
  contentType: z.string(),
  createdAt: z.coerce.date(),
})

// Template `channels` and `categories` are stored as comma-separated strings
// in MSSQL but exposed here as arrays — the db adapter splits/joins.
export const TemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  channels: z.array(ChannelSchema),
  subject: z.string().nullable(),
  body: z.string(),
  categories: z.array(z.string()),
  status: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// Input shape for the logging adapter. Any route that wants to persist an
// outbound message calls this after the provider has accepted the send.
export const LogOutboundRecipientSchema = z.object({
  contactCode: z.string().optional(),
  toAddress: z.string(),
  externalMessageId: z.string().optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  error: z.string().optional(),
})

export const LogOutboundParamsSchema = z.object({
  channel: ChannelSchema,
  fromAddress: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  messageType: z.string(),
  provider: z.string(),
  triggeredByUser: z.string().optional(),
  // passthrough() ensures the emitted JSON schema has a `properties: {}` object,
  // which koa-okapi-router's media-type linker requires (it Object.entries() it).
  audienceCriteria: z.object({}).passthrough().optional(),
  templateId: z.string().uuid().optional(),
  workOrderCode: z.string().optional(),
  recipients: z.array(LogOutboundRecipientSchema),
})

// Read-side response shapes
export const DispatchWithRecipientsSchema = z.object({
  dispatch: DispatchSchema,
  recipients: z.array(MessageRecipientSchema),
})

export const CustomerMessageSchema = z.object({
  dispatch: DispatchSchema,
  recipient: MessageRecipientSchema,
})
