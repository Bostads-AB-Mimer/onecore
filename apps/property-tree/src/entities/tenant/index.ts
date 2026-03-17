// UI Components
export { TenantCard } from './ui/TenantCard'
export { TenantContactActions } from './ui/TenantContactActions'
export { TenantLeaseCard } from './ui/TenantLeaseCard'
export { TenantPersonalInfo } from './ui/TenantPersonalInfo'

// Formatting utilities
export { formatTenantAddress, formatTenantName } from './lib/formatting'

// Classification utilities
export { getTenantRoles, isOrganization } from './lib/classification'

// Hooks
export { useTenant } from './hooks/useTenant'
export { useTenantComments } from './hooks/useTenantComments'
export { useTenantInvoices } from './hooks/useTenantInvoices'
export { useTenantSearch } from './hooks/useTenantSearch'
