// Pages library entry. Hosts mount `leasingModule`; the loose exports stay for the standalone shell.
export { LeasingHostProvider } from './host/LeasingHostProvider'
export { useLeasingHost } from './host/useLeasingHost'
export type { LeasingHostConfig, LeasingUser } from './host/types'
export { leasingRoutes } from './pages/routes'
export { leasingModule } from './module'
