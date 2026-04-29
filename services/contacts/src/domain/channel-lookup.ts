import { ChannelLookupSchema } from '@src/services/contacts-service/schema'
import z from 'zod'

export type ChannelLookup = z.infer<typeof ChannelLookupSchema>
