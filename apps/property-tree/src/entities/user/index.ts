// Hooks
export { useHasRole } from './hooks/useHasRole'
export { useUser } from './hooks/useUser'

// Lib
export { GUIDES_ADMIN_ROLE, hasRole } from './lib/roles'
export {
  CONTACTS_WRITE_ROLE,
  hasAnyRole,
  HOME_INSURANCE_READ_ROLE,
  HOME_INSURANCE_WRITE_ROLE,
  INVOICE_DEFERRAL_ROLE,
  OPEN_INVOICES_READ_ROLE,
} from './roles'

// Types
export type { User } from './types'
export { RequireRole } from './ui/RequireRole'
