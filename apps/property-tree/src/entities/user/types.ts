export type User = {
  id: string
  name: string
  email: string
  realm_access?: { roles?: string[] }
}
