// Object-level search over the property hierarchy: the shared tree picker
// scopes a paginated rental-object list.

export { useRentalObjectSearch } from './hooks/useRentalObjectSearch'
export type { RentalObjectScopes } from './model/scopes'
export { hasAnyScope, selectionToScopes } from './model/scopes'
export { RentalObjectSearch } from './ui/RentalObjectSearch'
