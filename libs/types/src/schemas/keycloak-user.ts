import { z } from 'zod'

/**
 * The user core resolves from a Keycloak token (`ctx.state.user`, served by
 * `GET /auth/profile`). Keycloak logins only: legacy JWT service accounts
 * produce a different shape and are not covered here.
 */
export const KeycloakUserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  /** Xpand signature (e.g. "YY2333"), present once the realm maps employeeId. */
  employeeId: z.string().optional(),
  source: z.literal('keycloak'),
  realm_access: z
    .object({
      roles: z.array(z.string()),
    })
    .optional(),
})

export type KeycloakUser = z.infer<typeof KeycloakUserSchema>
