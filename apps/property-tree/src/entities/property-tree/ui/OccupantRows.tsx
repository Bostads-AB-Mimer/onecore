// Rental-object rows. The objects themselves come from the walk tree like
// every other level; the only thing added here is the tenant join, which is
// per property and cannot ride on the cached object payload.

import { usePropertyTenants } from '../hooks/useOccupantData'
import type { ObjectFilterView } from '../model/facets'
import { objectRowExcluded } from '../model/facets'
import type {
  PropertyTreeNode,
  PropertyTreeSelection,
} from '../model/selection'
import { nodeCheckState } from '../model/selection'
import type { ObjectRowSpec } from '../model/treeRows'
import { ObjectRow } from './rows'

/**
 * One object row, decorated with its current tenants. react-query dedupes the
 * lookup, so a property's rows share a single request however many are drawn.
 */
export function ObjectTenantRow({
  row,
  selection,
  view,
  selectableObjects,
  onToggleObject,
}: {
  row: ObjectRowSpec
  selection: PropertyTreeSelection
  view: ObjectFilterView
  selectableObjects: boolean
  onToggleObject: (node: PropertyTreeNode) => void
}) {
  const tenants = usePropertyTenants(row.propertyDesignation)

  return (
    <ObjectRow
      depth={row.depth}
      object={row.object}
      tenants={
        tenants.data
          ? (tenants.data.tenantsByCode[row.object.rentalId] ?? [])
          : undefined
      }
      checkState={nodeCheckState(selection, row.node)}
      selectable={selectableObjects}
      // Recipient semantics only where objects are not picked individually: a
      // vakant object reaches nobody, so it shows no inherited tick there.
      requiresTenants={!selectableObjects}
      onCheck={() => onToggleObject(row.node)}
      excluded={objectRowExcluded(row.object, view)}
    />
  )
}
