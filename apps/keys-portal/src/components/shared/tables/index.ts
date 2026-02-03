// Hooks
export { useExpandableRows } from '@/hooks/useExpandableRows'
export type {
  UseExpandableRowsOptions,
  UseExpandableRowsReturn,
} from '@/hooks/useExpandableRows'

export { useItemSelection } from '@/hooks/useItemSelection'
export type {
  UseItemSelectionOptions,
  UseItemSelectionReturn,
} from '@/hooks/useItemSelection'

export { useCollapsibleSections } from '@/hooks/useCollapsibleSections'
export type {
  UseCollapsibleSectionsOptions,
  UseCollapsibleSectionsReturn,
} from '@/hooks/useCollapsibleSections'

// Components
export { CollapsibleGroupTable } from './CollapsibleGroupTable'
export type {
  CollapsibleGroupTableProps,
  RowRenderProps,
  ItemGroup,
  Section,
} from './CollapsibleGroupTable'

export { FilterableTableHeader } from './FilterableTableHeader'
export type { FilterableTableHeaderProps } from './FilterableTableHeader'

export { ExpandButton } from './ExpandButton'
export type { ExpandButtonProps } from './ExpandButton'

export { ActionMenu } from './ActionMenu'
export type { ActionMenuProps } from './ActionMenu'

export { DefaultLoanHeader } from './DefaultLoanHeader'
export type { DefaultLoanHeaderProps } from './DefaultLoanHeader'

// Status Badges
export {
  LoanStatusBadge,
  KeyTypeBadge,
  KeyEventBadge,
  DisposedBadge,
  KeyStatusBadge,
  CardStatusBadge,
  PickupAvailabilityBadge,
  ItemTypeBadge,
  ItemDisposedBadge,
  getLoanStatusType,
  getKeyEventDisplayLabel,
  isActiveKeyEvent,
  getLatestActiveEvent,
  getPickupAvailability,
} from './StatusBadges'
export type {
  LoanStatusType,
  PickupAvailabilityType,
  PickupAvailabilityStatus,
} from './StatusBadges'
