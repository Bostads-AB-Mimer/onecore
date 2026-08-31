export type User = {
  id: string
  name: string
  email: string
  // Xpand signature (e.g. "YY2333") from the Keycloak employeeId token claim.
  // Absent until the token mapper is configured for the realm (MIM-1851).
  employeeId?: string
  roles: string[]
}
