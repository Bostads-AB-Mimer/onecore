import type { components } from '@/services/api/core/generated/api-types'

type KeycloakUser = components['schemas']['KeycloakUser']

// Canonical inspector identity (MIM-1851): "Vincent Cheron (YY2333)" — the
// same format Xpand uses in cmctc.cmctcben — so rows from both sources
// compare equal with plain string equality. Every writer AND every filter of
// inspection.inspector must build the string through this function; a format
// drift between sites silently breaks the exact-match filtering. Falls back
// to the bare name until the employeeId reaches the user.
export function formatInspectorIdentity(
  name: string,
  employeeId?: string
): string {
  return employeeId ? `${name} (${employeeId})` : name
}

// Same identity built from a Keycloak admin-API user (the inspector
// dropdowns). Keycloak stores attributes as string arrays; employeeId holds
// the inspector's Xpand signature.
export function formatInspectorName(
  user: Pick<KeycloakUser, 'firstName' | 'lastName' | 'attributes'>
): string {
  return formatInspectorIdentity(
    `${user.firstName} ${user.lastName}`,
    user.attributes?.employeeId?.[0]
  )
}
