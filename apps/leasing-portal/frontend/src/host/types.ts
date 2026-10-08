import type { ModuleUser } from '@onecore/ui'

/** The logged-in user as the host knows it; one shape with the module contract. */
export type LeasingUser = ModuleUser

export interface LeasingHostConfig {
  /** Base URL of the leasing portal backend, including its prefix, e.g. https://api.mimer.nu/leasing-portal */
  bffUrl: string
  /** Base URL of core, e.g. https://api.mimer.nu. Used to refresh the session on a 401. */
  coreUrl: string
  user: LeasingUser
}
