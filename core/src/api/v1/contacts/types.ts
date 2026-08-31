import z from 'zod'

import { ContactAddressSchema, ContactSchema } from './schema'

export type Contact_APIv1 = z.infer<typeof ContactSchema>

export type ContactAddress_APIv1 = z.infer<typeof ContactAddressSchema>
