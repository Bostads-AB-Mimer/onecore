import { z } from 'zod'

export const DIRECTION = ['outbound', 'inbound'] as const
export const CHANNEL = ['sms', 'email', 'call'] as const
// Templates render message content; calls have none, so template channels
// stay narrower than dispatch channels.
export const TEMPLATE_CHANNEL = ['sms', 'email'] as const
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
export const TemplateChannelSchema = z.enum(TEMPLATE_CHANNEL)
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
  // Odoo errand code ("od-<id>") — set on dispatches triggered from an Odoo
  // errand, used by the frontend to link the log entry to the errand in Odoo.
  workOrderCode: z.string().nullable(),
  inReplyToDispatchId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
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
  channels: z.array(TemplateChannelSchema),
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
  workOrderCode: z.string().optional(),
  templateId: z.string().uuid().optional(),
  recipients: z.array(LogOutboundRecipientSchema),
})

// Request body Odoo POSTs (via core) when an employee triggers a phone call
// from an errand. The service maps it onto a 'call' dispatch itself, so
// channel/provider/status are not part of the payload.
export const LogCallParamsSchema = z.object({
  phoneNumber: z.string().min(1),
  contactCode: z.string().min(1),
  // Odoo errand code — the strict format guarantees the frontend can build
  // a working link into Odoo from it.
  workOrderCode: z.string().regex(/^od-\d+$/),
  triggeredByUser: z.string().optional(),
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
