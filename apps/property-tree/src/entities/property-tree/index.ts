// Traversal and selection over the property hierarchy — districts/KVV-areas
// or marknadsområden down to trapphus, with rental objects as leaves. Knows
// nothing about what a selection is used for; consumers map it themselves.

export {
  RENTAL_OBJECT_GROUP_LABELS,
  RENTAL_OBJECT_TYPE_LABELS,
} from './hooks/useOccupantData'
export type {
  PropertyTree,
  PropertyTreeBuilding,
  PropertyTreeGroup,
  PropertyTreeParkingArea,
  PropertyTreeProperty,
  PropertyTreeRoot,
  PropertyTreeStaircase,
  TreeGrouping,
} from './hooks/usePropertyTreeData'
export {
  usePropertyTree,
  usePropertyTreeRoots,
  usePropertyTrees,
} from './hooks/usePropertyTreeData'
export type { RentalObjectSubtype } from './hooks/useRentalObjectSubtypes'
export {
  subtypeKey,
  useRentalObjectSubtypes,
} from './hooks/useRentalObjectSubtypes'
export type { RentalObject } from './hooks/useRootRentalObjects'
export { useRootRentalObjects } from './hooks/useRootRentalObjects'
export type { GetParentInfo } from './hooks/useTreeSelectionState'
export { useTreeSelectionState } from './hooks/useTreeSelectionState'
export type { FacetIndex, ObjectFilter, ObjectFilterView } from './model/facets'
export { buildFacetIndex, objectMatches, PENDING_FACETS } from './model/facets'
export {
  LEVEL_LABELS,
  LEVEL_PLURAL_LABELS,
  nodeValueLabel,
  rememberNodeLabel,
} from './model/labels'
export type {
  CheckState,
  ParentInfo,
  PropertyTreeLevel,
  PropertyTreeNode,
  PropertyTreeSelection,
  RentalObjectType,
} from './model/selection'
export {
  ALL_RENTAL_OBJECT_TYPES,
  emptySelection,
  nodeCheckState,
  nodeKey,
} from './model/selection'
export { rootKeyOf } from './model/treeRows'
export type { PropertyTreeFilters } from './ui/PropertyTreePicker'
export { PropertyTreePicker } from './ui/PropertyTreePicker'
