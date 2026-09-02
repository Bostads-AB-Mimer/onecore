// Traversal and selection over the property hierarchy — districts/KVV-areas
// or marknadsområden down to trapphus, with rental objects as leaves. Knows
// nothing about what a selection is used for; consumers map it themselves.

export { useRentalObjectSubtypes } from './hooks/useRentalObjectSubtypes'
export { useTreeSelectionState } from './hooks/useTreeSelectionState'
export { LEVEL_LABELS, RENTAL_OBJECT_TYPE_LABELS } from './model/labels'
export type {
  PropertyTreeLevel,
  PropertyTreeNode,
  RentalObjectType,
} from './model/selection'
export { ALL_RENTAL_OBJECT_TYPES } from './model/selection'
export type { PropertyTreeFilters } from './ui/PropertyTreePicker'
export { PropertyTreePicker } from './ui/PropertyTreePicker'
