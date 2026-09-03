import { property } from '@onecore/types'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here.
export const {
  PropertyGroupingSchema,
  PROPERTY_TREE_STRUCTURAL_TYPES,
  PROPERTY_TREE_NODE_TYPES,
  PropertyTreeNodeSchema,
  PropertyTreeGroupSchema,
  PropertyTreeSchema,
} = property

export type PropertyGrouping = property.PropertyGrouping
export type PropertyTreeNodeType = property.PropertyTreeNodeType
export type PropertyTreeNode = property.PropertyTreeNode
export type PropertyTreeChildNode = property.PropertyTreeChildNode
export type PropertyTree = property.PropertyTree
