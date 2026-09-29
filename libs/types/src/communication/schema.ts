import { z } from 'zod'

export const DIRECTION = ['outbound', 'inbound'] as const
export const CHANNEL = ['sms', 'email'] as const
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

export const RELEASE_NOTE_CATEGORY = [
  'feature',
  'fix',
  'improvement',
  'info',
  'warning',
] as const

// Which part of ONECore a note concerns. A label, not a visibility filter.
export const RELEASE_NOTE_APP = [
  'general',
  'property-tree',
  'keys-portal',
  'internal-portal',
  'mina-sidor',
  'sok-ledigt',
  'odoo',
  'core',
  'leasing',
  'property',
  'work-order',
  'keys',
  'communication',
  'contacts',
  'inspection',
  'economy',
] as const

export const ReleaseNoteCategorySchema = z.enum(RELEASE_NOTE_CATEGORY)
export const ReleaseNoteAppSchema = z.enum(RELEASE_NOTE_APP)

// publishedAt null = draft, hidden from readers without release-notes:write.
export const ReleaseNoteSchema = z.object({
  id: z.string().uuid(),
  app: ReleaseNoteAppSchema,
  title: z.string(),
  description: z.string(),
  category: ReleaseNoteCategorySchema,
  pinned: z.boolean(),
  publishedAt: z.coerce.date().nullable(),
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// Standalone objects (no omit/extend): swagger dedup depends on key order.
export const CreateReleaseNoteSchema = z.object({
  app: ReleaseNoteAppSchema,
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  category: ReleaseNoteCategorySchema,
  pinned: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
})

export const UpdateReleaseNoteSchema = z.object({
  app: ReleaseNoteAppSchema.optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().min(1).optional(),
  category: ReleaseNoteCategorySchema.optional(),
  pinned: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
})

// Service-level create input: core stamps createdBy from the verified token.
export const CreateReleaseNoteParamsSchema = z.object({
  app: ReleaseNoteAppSchema,
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  category: ReleaseNoteCategorySchema,
  pinned: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  createdBy: z.string().min(1),
})
