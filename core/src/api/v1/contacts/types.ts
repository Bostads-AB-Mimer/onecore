import z from 'zod'

import { ContactSchema } from './schema'

export type Contact_APIv1 = z.infer<typeof ContactSchema>
