/** The logged-in user as the host knows it. Hosts map their own user shape to this. */
export interface LeasingUser {
  id: string
  name?: string
  email?: string
  roles: string[]
}

export interface LeasingHostConfig {
  /** Base URL of the leasing portal backend, including its prefix, e.g. https://api.mimer.nu/leasing-portal */
  bffUrl: string
  /** Base URL of core, e.g. https://api.mimer.nu. Used to refresh the session on a 401. */
  coreUrl: string
  user: LeasingUser
}
