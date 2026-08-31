import type { KeycloakUser } from '../auth-service/keycloak-admin-adapter'

export function toUserSummary(user: KeycloakUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobilePhone: user.attributes?.mobilePhone?.[0],
    employeeId: user.attributes?.employeeId?.[0],
  }
}
