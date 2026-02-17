/**
 * Extract roles from Keycloak token claims
 * Aggregates roles from multiple sources:
 * - realm_access.roles (Keycloak realm roles)
 * - resource_access.<client>.roles (client-specific roles)
 * - groups (Azure AD groups mapped to Keycloak)
 */

interface TokenClaims {
  realm_access?: {
    roles?: string[]
  }
  resource_access?: {
    [clientId: string]: {
      roles?: string[]
    }
  }
  groups?: string[]
}

export function extractRolesFromToken(
  tokenClaims: TokenClaims,
  clientId?: string
): string[] {
  const roles = new Set<string>()

  // 1. Extract realm-level roles
  const realmRoles = tokenClaims.realm_access?.roles || []
  realmRoles.forEach((role) => roles.add(role))

  // 2. Extract client-specific roles (if clientId provided)
  if (clientId && tokenClaims.resource_access?.[clientId]?.roles) {
    const clientRoles = tokenClaims.resource_access[clientId].roles || []
    clientRoles.forEach((role) => roles.add(role))
  }

  // 3. Extract Azure AD groups (if mapped as 'groups' claim)
  const groups = tokenClaims.groups || []
  groups.forEach((group) => roles.add(group))

  // Return unique, sorted array
  return Array.from(roles).sort()
}
