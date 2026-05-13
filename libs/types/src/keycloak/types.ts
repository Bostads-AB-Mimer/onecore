import { z } from 'zod'

import { EnrichedKeycloakUserSchema } from './schema'

export type EnrichedKeycloakUser = z.infer<typeof EnrichedKeycloakUserSchema>
