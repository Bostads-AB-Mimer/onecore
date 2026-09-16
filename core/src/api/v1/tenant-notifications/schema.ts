import { z } from 'zod'
import { TenantNotificationSchema } from '@onecore/types'

import { ONECoreHateOASResponseBodySchema } from '../contacts/schema'

export const SendTenantNotificationRequestBodySchema = TenantNotificationSchema

export const SendTenantNotificationResponseBodySchema_APIv1 =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      sent: z.literal(true),
    }),
  })

export const SendTenantNotificationErrorResponseBodySchema_APIv1 = z.object({
  error: z.string(),
  detail: z.string().optional(),
})
