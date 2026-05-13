import { z } from 'zod'

// Shape returned by the core helper `enrichKeycloakUsers` and embedded in API
// responses (e.g. förvaltningsområde board / list) so the frontend doesn't have to
// resolve Keycloak ids itself.
export const EnrichedKeycloakUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
})
